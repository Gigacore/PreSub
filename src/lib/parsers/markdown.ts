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
import { extractFrontMatter } from '../utils/text';
import { toISO } from '../utils/date';
import { annotateMetadataWithNamedEntities } from '../analysis/nlp';

export async function parseMarkdown(file: File): Promise<ProcessedFile> {
  const text = await file.text();
  const processedFile: ProcessedFile = {
    fileName: file.name,
    metadata: {
      fileType: 'Markdown',
    },
  };

  try {
    // Front matter (YAML between --- lines at top)
    const fm = extractFrontMatter(text);
    if (fm) {
      const { data } = fm;
      // Shallow assign common fields
      if (data.title) (processedFile.metadata as any).title = String(data.title);
      if (data.description) (processedFile.metadata as any).description = String(data.description);
      if (data.date) (processedFile.metadata as any).creationDate = toISO(String(data.date)) || String(data.date);
      if (data.tags) (processedFile.metadata as any).tags = Array.isArray(data.tags) ? data.tags : String(data.tags);
      if (data.category) (processedFile.metadata as any).category = String(data.category);

      // Authors can be author (string) or authors (array)
      let authors: string[] = [];
      if (Array.isArray(data.authors)) {
        authors = data.authors.map((a: any) => String(a));
      } else if (data.author) {
        if (Array.isArray(data.author)) authors = data.author.map((a: any) => String(a));
        else authors = [String(data.author)];
      }
      if (authors.length) (processedFile.metadata as any).author = authors.length === 1 ? authors[0] : authors;

      // Potential issues for authors
      const issues: NonNullable<ProcessedFile['potentialIssues']> = [];
      for (const a of authors) {
        const trimmed = a.trim();
        if (trimmed && !containsLatex(trimmed)) issues.push({ type: 'AUTHOR FOUND', value: trimmed });
      }
      if (issues.length) processedFile.potentialIssues = issues;
    }

    // Derive title from first heading if missing
    if (!(processedFile.metadata as any).title) {
      const m = text.match(/^\s*#\s+(.+)$/m);
      if (m) (processedFile.metadata as any).title = m[1].trim();
    }

    // Basic content counts
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    (processedFile.metadata as any).wordCount = words;
    // Count headings, links and images
    const headingCount = (text.match(/^\s*#{1,6}\s+/gm) || []).length;
    const inlineLinkCount = (text.match(/\[[^\]]*\]\([^\)]+\)/g) || []).length;
    const imageCount = (text.match(/!\[[^\]]*\]\([^\)]+\)/g) || []).length;
    (processedFile.metadata as any).headingCount = headingCount;
    (processedFile.metadata as any).linkCount = inlineLinkCount;
    (processedFile.metadata as any).imageCount = imageCount;

    // Content scan: scan by line and record line numbers
    const emailPages = new Map<string, Set<number>>();
    const urlPages = new Map<string, Set<number>>();
    const ackMap = new Map<string, Set<number>>();
    const affMap = new Map<string, Set<number>>();
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
      const page = idx + 1; // treat line number as page index
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

      // Research findings by line
      if (ACK_HEADERS_RE.test(line)) addFinding(ackMap, line, page);
      if (AFFIL_HEADER_RE.test(line) || AFFIL_CUES_RE.test(line)) addFinding(affMap, line, page);

      // Also capture Markdown inline links and reference definitions
      // Inline: [text](url) or ![alt](url)
      const inlineLinkRe = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
      let m: RegExpExecArray | null;
      while ((m = inlineLinkRe.exec(line)) !== null) {
        const target = m[1];
        scanTextForEmailsAndUrls(target, (value, kind) => {
          if (kind === 'email') {
            if (!emailPages.has(value)) emailPages.set(value, new Set());
            emailPages.get(value)!.add(page);
          } else {
            if (!urlPages.has(value)) urlPages.set(value, new Set());
            urlPages.get(value)!.add(page);
          }
        });
      }

      // Reference definition: [label]: url "title"
      const refDef = line.match(/^\s*\[[^\]]+\]:\s+(\S+)/);
      if (refDef) {
        const target = refDef[1];
        scanTextForEmailsAndUrls(target, (value, kind) => {
          if (kind === 'email') {
            if (!emailPages.has(value)) emailPages.set(value, new Set());
            emailPages.get(value)!.add(page);
          } else {
            if (!urlPages.has(value)) urlPages.set(value, new Set());
            urlPages.get(value)!.add(page);
          }
        });
      }
    });

    const emailList = Array.from(emailPages.keys());
    const urlList = Array.from(urlPages.keys());
    if (emailList.length) (processedFile.metadata as any).emailsFound = emailList;
    if (urlList.length) (processedFile.metadata as any).urlsFound = urlList;
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

    // Research signals + findings from Markdown
    if (text && text.replace(/\s+/g, '').length > 20) {
      const signals = scanResearchSignals(text);
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

    await annotateMetadataWithNamedEntities(processedFile.metadata);
  } catch (e) {
    console.warn('Markdown parse warning:', e);
    (processedFile.metadata as any).error = 'Could not parse Markdown content';
  }

  return processedFile;
}
