import type { ProcessedFile } from '../../App';
import { containsLatex } from '../utils/misc';
import { scanTextForEmailsAndUrls } from '../analysis/content-scanner';
import {
  addFinding,
  ACK_HEADERS_RE,
  AFFIL_CUES_RE,
  AFFIL_HEADER_RE,
} from '../analysis/research-signals';
import {
  extractNamedEntities,
  addEntitiesToAccumulator,
  finalizeAccumulator,
  attachPositionsFromLines,
  NAMED_ENTITY_MODEL_ID,
  type EntityAccumulatorEntry,
} from '../analysis/nlp';

export async function parseJson(file: File): Promise<ProcessedFile> {
  const text = await file.text();
  const processedFile: ProcessedFile = {
    fileName: file.name,
    metadata: {
      fileType: 'JSON',
    },
  };

  try {
    const entityAccumulator = new Map<string, EntityAccumulatorEntry>();
    let nlpAttempted = false;
    let nlpAnySuccess = false;
    let nlpAnyFailure = false;
    let nlpErrorMessage: string | undefined;
    let nlpModel: string | undefined;
    let nlpTruncated = false;
    const parsed = JSON.parse(text);

    // Basic structural metadata
    const isArray = Array.isArray(parsed);
    (processedFile.metadata as any).topLevelType = isArray ? 'array' : typeof parsed;
    if (isArray) {
      (processedFile.metadata as any).arrayLength = (parsed as any[]).length;
    } else if (parsed && typeof parsed === 'object') {
      const keys = Object.keys(parsed as Record<string, unknown>);
      (processedFile.metadata as any).topLevelKeys = keys;
      (processedFile.metadata as any).topLevelKeyCount = keys.length;
    }

    // Traverse to collect depth and type counts, and author-like fields
    const typeCounts: Record<string, number> = { string: 0, number: 0, boolean: 0, null: 0, object: 0, array: 0 };
    let maxDepth = 0;
    const potentialIssues: NonNullable<ProcessedFile['potentialIssues']> = [];
    const authors: string[] = [];
    const creators: string[] = [];
    const lastModifiedBys: string[] = [];

    const collect = (obj: any, depth: number, path: string) => {
      if (depth > maxDepth) maxDepth = depth;
      if (obj === null) {
        typeCounts.null++;
        return;
      }
      const t = Array.isArray(obj) ? 'array' : typeof obj;
      if (t === 'array') typeCounts.array++;
      else if (t === 'object') typeCounts.object++;
      else if (t === 'string') typeCounts.string++;
      else if (t === 'number') typeCounts.number++;
      else if (t === 'boolean') typeCounts.boolean++;

      if (t === 'object') {
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          const lk = k.toLowerCase();
          const np = path + '/' + k.replace(/~/g, '~0').replace(/\//g, '~1');
          // Detect likely author/creator fields
          if (typeof v === 'string') {
            if (lk === 'author' || lk.endsWith('author')) authors.push(v);
            if (lk === 'creator' || lk.endsWith('creator')) creators.push(v);
            if (lk === 'lastmodifiedby' || lk === 'modifiedby' || lk === 'last_modified_by') lastModifiedBys.push(v);
          }
          collect(v as any, depth + 1, np);
        }
      } else if (t === 'array') {
        (obj as any[]).forEach((v, i) => collect(v, depth + 1, path + '/' + i));
      }
    };

    collect(parsed, 0, '');
    (processedFile.metadata as any).maxDepth = maxDepth;
    (processedFile.metadata as any).typeCounts = typeCounts;

    // Assign authors/creators to metadata (dedup)
    const uniq = (arr: string[]) => Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
    const uAuthors = uniq(authors);
    const uCreators = uniq(creators);
    const uLmb = uniq(lastModifiedBys);
    if (uAuthors.length) (processedFile.metadata as any).author = uAuthors.length === 1 ? uAuthors[0] : uAuthors;
    if (uCreators.length) (processedFile.metadata as any).creator = uCreators.length === 1 ? uCreators[0] : uCreators;
    if (uLmb.length) (processedFile.metadata as any).lastModifiedBy = uLmb.length === 1 ? uLmb[0] : uLmb;

    // Flag potential issues for those
    for (const a of uAuthors) if (!containsLatex(a)) potentialIssues.push({ type: 'AUTHOR FOUND', value: a });
    for (const c of uCreators) if (!containsLatex(c)) potentialIssues.push({ type: 'CREATOR FOUND', value: c });
    for (const l of uLmb) if (!containsLatex(l)) potentialIssues.push({ type: 'LAST MODIFIED BY FOUND', value: l });

    if (potentialIssues.length) processedFile.potentialIssues = potentialIssues;

    // Content scan: by raw text lines to get accurate line numbers
    const emailPages = new Map<string, Set<number>>();
    const urlPages = new Map<string, Set<number>>();
    const ackMap = new Map<string, Set<number>>();
    const affMap = new Map<string, Set<number>>();
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
      const page = idx + 1;
      if (!line.trim()) return;
      scanTextForEmailsAndUrls(line, (value, kind) => {
        if (kind === 'email') {
          if (!emailPages.has(value)) emailPages.set(value, new Set());
          emailPages.get(value)!.add(page);
        } else {
          if (!urlPages.has(value)) urlPages.set(value, new Set());
          urlPages.get(value)!.add(page);
        }
      });
      if (ACK_HEADERS_RE.test(line)) addFinding(ackMap, line, page);
      if (AFFIL_HEADER_RE.test(line) || AFFIL_CUES_RE.test(line)) addFinding(affMap, line, page);
    });

    if (text.trim()) {
      nlpAttempted = true;
      try {
        const nerResult = await extractNamedEntities(text);
        if (nerResult.available) {
          nlpAnySuccess = true;
          if (!nlpModel && nerResult.model) nlpModel = nerResult.model;
          if (nerResult.truncated) nlpTruncated = true;
          if (nerResult.items.length) {
            addEntitiesToAccumulator(entityAccumulator, nerResult.items);
          }
        } else {
          nlpAnyFailure = true;
          if (!nlpErrorMessage && nerResult.error) nlpErrorMessage = nerResult.error;
        }
      } catch (err) {
        nlpAnyFailure = true;
        if (!nlpErrorMessage) nlpErrorMessage = err instanceof Error ? err.message : String(err);
      }
    }

    const emailList = Array.from(emailPages.keys());
    const urlList = Array.from(urlPages.keys());
    if (emailList.length) (processedFile.metadata as any).emailsFound = emailList;
    if (urlList.length) (processedFile.metadata as any).urlsFound = urlList;
    const entityFindings = finalizeAccumulator(entityAccumulator);
    const enrichedEntities = attachPositionsFromLines(entityFindings, lines);
    const hasEmails = emailList.length > 0;
    const hasUrls = urlList.length > 0;
    const hasEntities = enrichedEntities.length > 0;
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
        contentFindings.entities = enrichedEntities;
        contentFindings.entityPositionLabel = 'Lines';
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
    // Research findings + metadata flags from JSON text
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
    console.warn('JSON parse warning:', e);
    (processedFile.metadata as any).error = 'Invalid JSON';
  }

  return processedFile;
}
