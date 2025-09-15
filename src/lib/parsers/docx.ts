import mammoth from 'mammoth';
import type { ProcessedFile } from '../../App';
import { containsLatex } from '../utils/misc';
import { scanTextForEmailsAndUrls } from '../analysis/content-scanner';
import {
  addFinding,
  scanResearchSignals,
  ACK_HEADERS_RE,
  AFFIL_CUES_RE,
  AFFIL_HEADER_RE,
} from '../analysis/research-signals';
import { extractOOXMLMetadata } from '../utils/ooxml';

export async function parseDocx(file: File): Promise<ProcessedFile> {
  const arrayBuffer = await file.arrayBuffer();
  const processedFile: ProcessedFile = {
    fileName: file.name,
    metadata: {
      fileType: 'Microsoft Word Document',
    },
  };

  try {
    // Try to extract metadata from OOXML core/app properties
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
      // Ignore metadata errors for docx; continue with text extraction
      console.warn('DOCX metadata extraction skipped:', e);
    }

    const result = await mammoth.extractRawText({ arrayBuffer });
    const rawText = result.value || '';

    // Scan the extracted text for emails and URLs.
    try {
      const emails = new Set<string>();
      const urls = new Set<string>();
      scanTextForEmailsAndUrls(rawText, (value, kind) => {
        if (kind === 'email') emails.add(value);
        else urls.add(value);
      });

      const emailList = Array.from(emails.keys());
      const urlList = Array.from(urls.keys());

      if (emailList.length) {
        processedFile.metadata.emailsFound = emailList;
      }
      if (urlList.length) {
        processedFile.metadata.urlsFound = urlList;
      }

      if (emailList.length || urlList.length) {
        // Word pages are not available from text extraction; default to page 1
        processedFile.contentFindings = {
          emails: emailList.map((e) => ({ value: e, pages: [1] })),
          urls: urlList.map((u) => ({ value: u, pages: [1] })),
        };
      }
      // Research signals and findings from full text
      if (rawText && rawText.replace(/\s+/g, '').length > 20) {
        const signals = scanResearchSignals(rawText);

        // Build findings using line numbers (best effort)
        const ackMap = new Map<string, Set<number>>();
        const affMap = new Map<string, Set<number>>();
        const lines = rawText.split(/\r?\n/);
        lines.forEach((line, idx) => {
          const page = idx + 1; // treat line index as page/line marker
          if (!line.trim()) return;
          // Only capture explicit acknowledgements headers
          if (ACK_HEADERS_RE.test(line)) addFinding(ackMap, line, page);
          if (AFFIL_HEADER_RE.test(line) || AFFIL_CUES_RE.test(line)) addFinding(affMap, line, page);
        });
        const ackItems = Array.from(ackMap.keys()).map((t) => ({ text: t, pages: Array.from(ackMap.get(t)!).sort((a, b) => a - b) }));
        const affItems = Array.from(affMap.keys()).map((t) => ({ text: t, pages: Array.from(affMap.get(t)!).sort((a, b) => a - b) }));
        if (ackItems.length || affItems.length) {
          (processedFile as any).researchFindings = {
            acknowledgements: ackItems,
            affiliations: affItems,
          };
        }

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
      console.warn('DOCX content scan skipped:', e);
    }
  } catch (e) {
    console.error('Error parsing docx:', e);
    processedFile.metadata.error = 'Could not parse .docx file (only .docx supported)';
  }

  return processedFile;
}
