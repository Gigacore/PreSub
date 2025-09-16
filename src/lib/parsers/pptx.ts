import JSZip from 'jszip';
import type { ProcessedFile } from '../../App';
import { containsLatex } from '../utils/misc';
import { scanTextForEmailsAndUrls } from '../analysis/content-scanner';
import {
  addFinding,
  ACK_HEADERS_RE,
  AFFIL_CUES_RE,
  AFFIL_HEADER_RE,
} from '../analysis/research-signals';
import { extractOOXMLMetadata } from '../utils/ooxml';
import { safeReadText } from '../utils/zip';
import { parseXml } from '../utils/xml';
import {
  extractNamedEntities,
  addEntitiesToAccumulator,
  finalizeAccumulator,
  NAMED_ENTITY_MODEL_ID,
  type EntityAccumulatorEntry,
} from '../analysis/nlp';

export async function parsePptx(file: File): Promise<ProcessedFile> {
  const arrayBuffer = await file.arrayBuffer();
  const processedFile: ProcessedFile = {
    fileName: file.name,
    metadata: {
      fileType: 'Microsoft PowerPoint Presentation',
    },
  };

  try {
    const meta = await extractOOXMLMetadata(arrayBuffer);
    Object.assign(processedFile.metadata, meta);
    const author = typeof meta.author === 'string' ? meta.author.trim() : '';
    const creator = typeof meta.creator === 'string' ? meta.creator.trim() : '';
    const lastModifiedBy = typeof meta.lastModifiedBy === 'string' ? meta.lastModifiedBy.trim() : '';
    const issues: NonNullable<ProcessedFile['potentialIssues']> = [];
    if (author && !containsLatex(author)) issues.push({ type: 'AUTHOR FOUND', value: author });
    if (creator && !containsLatex(creator)) issues.push({ type: 'CREATOR FOUND', value: creator });
    if (lastModifiedBy && !containsLatex(lastModifiedBy)) issues.push({ type: 'LAST MODIFIED BY FOUND', value: lastModifiedBy });
    if (issues.length) processedFile.potentialIssues = issues;
  } catch (e) {
    console.warn('PPTX metadata extraction failed:', e);
    processedFile.metadata.note = 'Could not extract .pptx metadata';
  }
  // Content scan: iterate slide XML and slide hyperlink rels
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const emailPages = new Map<string, Set<number>>();
    const urlPages = new Map<string, Set<number>>();
    const ackMap = new Map<string, Set<number>>();
    const affMap = new Map<string, Set<number>>();
    const entityAccumulator = new Map<string, EntityAccumulatorEntry>();
    let nlpAttempted = false;
    let nlpAnySuccess = false;
    let nlpAnyFailure = false;
    let nlpErrorMessage: string | undefined;
    let nlpModel: string | undefined;
    let nlpTruncated = false;

    // Collect slide files and sort by slide number
    const slidePaths = Object.keys(zip.files)
      .map((k) => {
        const m = k.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
        return m ? { path: k, num: Number(m[1]) } : null;
      })
      .filter((x): x is { path: string; num: number } => !!x)
      .sort((a, b) => a.num - b.num);

    for (const { path, num } of slidePaths) {
      const xml = await safeReadText(zip, path);
      if (xml) {
        const doc = parseXml(xml);
        // Gather visible text from <a:t> runs
        const nodes = Array.from(doc.getElementsByTagName('*')) as Element[];
        const texts: string[] = [];
        for (const el of nodes) {
          if (el.localName === 't') {
            const t = (el.textContent || '').trim();
            if (t) texts.push(t);
          }
        }
        const joined = texts.join(' ');
        if (joined) {
          nlpAttempted = true;
          try {
            const nerResult = await extractNamedEntities(joined);
            if (nerResult.available) {
              nlpAnySuccess = true;
              if (!nlpModel && nerResult.model) nlpModel = nerResult.model;
              if (nerResult.truncated) nlpTruncated = true;
              if (nerResult.items.length) {
                addEntitiesToAccumulator(entityAccumulator, nerResult.items, num);
              }
            } else {
              nlpAnyFailure = true;
              if (!nlpErrorMessage && nerResult.error) nlpErrorMessage = nerResult.error;
            }
          } catch (err) {
            nlpAnyFailure = true;
            if (!nlpErrorMessage) nlpErrorMessage = err instanceof Error ? err.message : String(err);
          }
          scanTextForEmailsAndUrls(joined, (value, kind) => {
            if (kind === 'email') {
              if (!emailPages.has(value)) emailPages.set(value, new Set());
              emailPages.get(value)!.add(num);
            } else {
              if (!urlPages.has(value)) urlPages.set(value, new Set());
              urlPages.get(value)!.add(num);
            }
          });
          // Research findings: split sentences for clearer items
          const sentences = joined.split(/(?<=[.!?])\s+/);
          sentences.forEach((s: string) => {
            if (ACK_HEADERS_RE.test(s)) addFinding(ackMap, s, num);
            if (AFFIL_HEADER_RE.test(s) || AFFIL_CUES_RE.test(s)) addFinding(affMap, s, num);
          });
        }
      }

      // Slide-level hyperlink relationships
      const relPath = path.replace(/slides\/slide(\d+)\.xml$/i, 'slides/_rels/slide$1.xml.rels');
      const relXml = await safeReadText(zip, relPath);
      if (relXml) {
        const doc = parseXml(relXml);
        const rels = Array.from(doc.getElementsByTagName('Relationship')) as Element[];
        for (const rel of rels) {
          const type = rel.getAttribute('Type') || '';
          if (!/\/hyperlink$/i.test(type)) continue;
          const target = rel.getAttribute('Target') || '';
          if (!target) continue;
          if (/^mailto:/i.test(target)) {
            const addr = decodeURIComponent(target.replace(/^mailto:/i, '').split('?')[0]);
            if (addr) {
              if (!emailPages.has(addr)) emailPages.set(addr, new Set());
              emailPages.get(addr)!.add(num);
            }
          } else {
            scanTextForEmailsAndUrls(target, (value, kind) => {
              if (kind === 'email') {
                if (!emailPages.has(value)) emailPages.set(value, new Set());
                emailPages.get(value)!.add(num);
              } else {
                if (!urlPages.has(value)) urlPages.set(value, new Set());
                urlPages.get(value)!.add(num);
              }
            });
            if (ACK_HEADERS_RE.test(target)) addFinding(ackMap, target, num);
            if (AFFIL_HEADER_RE.test(target) || AFFIL_CUES_RE.test(target)) addFinding(affMap, target, num);
          }
        }
      }
    }

    const emailList = Array.from(emailPages.keys());
    const urlList = Array.from(urlPages.keys());
    if (emailList.length) (processedFile.metadata as any).emailsFound = emailList;
    if (urlList.length) (processedFile.metadata as any).urlsFound = urlList;
    const entityFindings = finalizeAccumulator(entityAccumulator);
    const hasEmails = emailList.length > 0;
    const hasUrls = urlList.length > 0;
    const hasEntities = entityFindings.length > 0;
    if (hasEmails || hasUrls || hasEntities) {
      const contentFindings =
        processedFile.contentFindings ?? {
          emails: [] as Array<{ value: string; pages: number[] }>,
          urls: [] as Array<{ value: string; pages: number[] }>,
        };
      contentFindings.emails = hasEmails
        ? emailList.map((e) => ({ value: e, pages: Array.from(emailPages.get(e)!).sort((a, b) => a - b) }))
        : contentFindings.emails;
      contentFindings.urls = hasUrls
        ? urlList.map((u) => ({ value: u, pages: Array.from(urlPages.get(u)!).sort((a, b) => a - b) }))
        : contentFindings.urls;
      if (hasEntities) {
        contentFindings.entities = entityFindings;
        contentFindings.entityPositionLabel = 'Slides';
      }
      processedFile.contentFindings = contentFindings;
    }

    if (nlpAttempted) {
      if (nlpAnySuccess) {
        (processedFile.metadata as any).nlpAnalysis = 'Transformers enabled';
        (processedFile.metadata as any).nlpModel = nlpModel ?? NAMED_ENTITY_MODEL_ID;
        if (nlpTruncated) {
          (processedFile.metadata as any).nlpAnalysisNote = 'Named entity detection truncated to reduce processing time.';
        }
        if (nlpAnyFailure && nlpErrorMessage) {
          (processedFile.metadata as any).nlpFallbackReason = nlpErrorMessage;
        }
      } else if (nlpAnyFailure) {
        (processedFile.metadata as any).nlpAnalysis = 'Fallback only (NLP unavailable)';
        if (nlpErrorMessage) (processedFile.metadata as any).nlpFallbackReason = nlpErrorMessage;
      }
    }
    // Research findings + metadata flags
    const ackItems = Array.from(ackMap.keys()).map((t) => ({ text: t, pages: Array.from(ackMap.get(t)!).sort((a, b) => a - b) }));
    const affItems = Array.from(affMap.keys()).map((t) => ({ text: t, pages: Array.from(affMap.get(t)!).sort((a, b) => a - b) }));
    if (ackItems.length || affItems.length) {
      (processedFile as any).researchFindings = {
        acknowledgements: ackItems,
        affiliations: affItems,
      };
      (processedFile.metadata as any).acknowledgementsDetected = ackItems.length > 0;
      if (ackItems.length) (processedFile.metadata as any).acknowledgementsExcerpt = ackItems[0].text;
      (processedFile.metadata as any).affiliationsDetected = affItems.length > 0;
      if (affItems.length) (processedFile.metadata as any).affiliationsGuesses = affItems.map((i) => i.text).slice(0, 8);
    }
  } catch (e) {
    console.warn('PPTX content scan skipped:', e);
  }

  return processedFile;
}
