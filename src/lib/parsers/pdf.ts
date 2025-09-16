import * as pdfjs from 'pdfjs-dist';
import type { ProcessedFile } from '../../App';
import { scanTextForEmailsAndUrls } from '../analysis/content-scanner';
import {
  addFinding,
  extractContextSnippet,
  scanResearchSignals,
  ACK_HEADERS_RE,
  AFFIL_CUES_RE,
  AFFIL_HEADER_RE,
} from '../analysis/research-signals';
import { annotateMetadataWithNamedEntities } from '../analysis/nlp';

// It's important to set the worker source for pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.mjs`;

export async function parsePdf(file: File): Promise<ProcessedFile> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument(arrayBuffer).promise;
  const metadata = await pdf.getMetadata();

  const processedFile: ProcessedFile = {
    fileName: file.name,
    metadata: {
      pages: pdf.numPages,
    },
  };

  // Track issues found across metadata and content
  const issues: NonNullable<ProcessedFile['potentialIssues']> = [];

  if (metadata.info) {
    const info = metadata.info as any; // pdfjs-dist types are not perfect
    const author = typeof info.Author === 'string' ? info.Author.trim() : '';
    const creator = typeof info.Creator === 'string' ? info.Creator.trim() : '';

    if (author) {
      issues.push({ type: 'AUTHOR FOUND', value: author });
    }
    if (creator) {
      issues.push({ type: 'CREATOR FOUND', value: creator });
    }
    processedFile.metadata.title = info.Title;
    processedFile.metadata.author = info.Author;
    processedFile.metadata.subject = info.Subject;
    processedFile.metadata.creator = info.Creator;
    processedFile.metadata.producer = info.Producer;
    processedFile.metadata.creationDate = info.CreationDate;
    processedFile.metadata.modificationDate = info.ModDate;
  }

  // Extract textual content to scan for emails and URLs (with page numbers)
  try {
    const emailPages = new Map<string, Set<number>>();
    const urlPages = new Map<string, Set<number>>();
    // Research findings accumulators (per page)
    const ackMap = new Map<string, Set<number>>();
    const affMap = new Map<string, Set<number>>();
    const fullTextParts: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc: any = await page.getTextContent();
      const text = (tc.items || [])
        .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
        .join(' ');
      if (text) fullTextParts.push(text);

      // Research: Acknowledgements (by sentence and header/phrases)
      if (text) {
        const sentences = text.split(/(?<=[.!?])\s+/);
        sentences.forEach((s: string) => {
          // Only capture explicit acknowledgements headers
          if (ACK_HEADERS_RE.test(s)) {
            addFinding(ackMap, s, p);
          }
        });
        // Fallback: only add context if not already captured by a sentence
        const mAck = text.match(ACK_HEADERS_RE);
        if (mAck && mAck.index !== undefined) {
          const phrase = String(mAck[0] || '').toLowerCase();
          const alreadyHasPhraseOnPage = Array.from(ackMap.entries()).some(([t, pages]) =>
            pages.has(p) && t.toLowerCase().includes(phrase)
          );
          if (!alreadyHasPhraseOnPage) {
            addFinding(ackMap, extractContextSnippet(text, mAck.index), p);
          }
        }
        // Research: Affiliations (by sentence and cues)
        const affSentences = text.split(/(?<=[.!?])\s+/).filter((s: string) => AFFIL_HEADER_RE.test(s) || AFFIL_CUES_RE.test(s));
        affSentences.forEach((s: string) => addFinding(affMap, s, p));
      }

      scanTextForEmailsAndUrls(text, (value, kind) => {
        if (kind === 'email') {
          if (!emailPages.has(value)) emailPages.set(value, new Set());
          emailPages.get(value)!.add(p);
        } else {
          if (!urlPages.has(value)) urlPages.set(value, new Set());
          urlPages.get(value)!.add(p);
        }
      });
    }

    // Summaries for metadata (backwards compatibility)
    const emailList = Array.from(emailPages.keys());
    const urlList = Array.from(urlPages.keys());
    if (emailList.length) {
      processedFile.metadata.emailsFound = emailList;
      // Do not add to potentialIssues; show as info banner instead
    }
    if (urlList.length) {
      processedFile.metadata.urlsFound = urlList;
      // Do not add to potentialIssues; show as info banner instead
    }

    const hasEmails = emailList.length > 0;
    const hasUrls = urlList.length > 0;
    if (hasEmails || hasUrls) {
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

      processedFile.contentFindings = contentFindings;
    }

    await annotateMetadataWithNamedEntities(processedFile.metadata);

    // Research signals + findings
    const fullText = fullTextParts.join('\n');
    const ackItems = Array.from(ackMap.keys()).map((t) => ({ text: t, pages: Array.from(ackMap.get(t)!).sort((a, b) => a - b) }));
    const affItems = Array.from(affMap.keys()).map((t) => ({ text: t, pages: Array.from(affMap.get(t)!).sort((a, b) => a - b) }));
    if (ackItems.length || affItems.length) {
      (processedFile as any).researchFindings = {
        acknowledgements: ackItems,
        affiliations: affItems,
      };
    }
    if (fullText && fullText.replace(/\s+/g, '').length > 20) {
      const signals = scanResearchSignals(fullText);
      // Override detection booleans based on findings to keep UI consistent
      (processedFile.metadata as any).acknowledgementsDetected = ackItems.length > 0 || signals.acknowledgementsDetected;
      if ((processedFile.metadata as any).acknowledgementsDetected) {
        const first = ackItems[0]?.text || signals.acknowledgementsExcerpt;
        if (first) (processedFile.metadata as any).acknowledgementsExcerpt = first;
      }
      (processedFile.metadata as any).fundingDetected = signals.fundingDetected;
      if (signals.fundingMentions?.length) (processedFile.metadata as any).fundingMentions = signals.fundingMentions;
      if (signals.grantIds?.length) (processedFile.metadata as any).grantIds = signals.grantIds;
      (processedFile.metadata as any).affiliationsDetected = affItems.length > 0 || signals.affiliationsDetected;
      if ((processedFile.metadata as any).affiliationsDetected) {
        const guesses = affItems.length ? affItems.map((i) => i.text) : signals.affiliationsGuesses || [];
        if (guesses.length) (processedFile.metadata as any).affiliationsGuesses = Array.from(new Set(guesses)).slice(0, 8);
      }
    }
  } catch (e) {
    // Text extraction might fail for scanned/image-only PDFs; ignore gracefully
    console.warn('PDF text extraction skipped:', e);
  }

  if (issues.length) processedFile.potentialIssues = issues;

  return processedFile;
}
