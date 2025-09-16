import * as XLSX from 'xlsx';
import type { ProcessedFile } from '../../App';
import { scanTextForEmailsAndUrls } from '../analysis/content-scanner';
import {
  addFinding,
  ACK_HEADERS_RE,
  AFFIL_CUES_RE,
  AFFIL_HEADER_RE,
} from '../analysis/research-signals';
import { annotateMetadataWithNamedEntities, shouldFlagPersonValue } from '../analysis/nlp';

export async function parseXlsx(file: File): Promise<ProcessedFile> {
  const arrayBuffer = await file.arrayBuffer();
  // Ensure correct mode when reading ArrayBuffer in the browser
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const props = workbook.Props;

  const processedFile: ProcessedFile = {
    fileName: file.name,
    metadata: {
      sheetNames: workbook.SheetNames.join(', '),
      numberOfSheets: workbook.SheetNames.length,
    },
  };

  if (props) {
    const author = typeof props.Author === 'string' ? props.Author.trim() : '';
    const creator = typeof (props as any).Creator === 'string' ? (props as any).Creator.trim() : '';
    const lastModifiedBy = typeof (props as any).LastAuthor === 'string' ? (props as any).LastAuthor.trim() : '';

    const issues: NonNullable<ProcessedFile['potentialIssues']> = [];
    if (author && (await shouldFlagPersonValue(author))) issues.push({ type: 'AUTHOR FOUND', value: author });
    if (creator && (await shouldFlagPersonValue(creator))) issues.push({ type: 'CREATOR FOUND', value: creator });
    if (lastModifiedBy && (await shouldFlagPersonValue(lastModifiedBy))) {
      issues.push({ type: 'LAST MODIFIED BY FOUND', value: lastModifiedBy });
    }
    if (issues.length) processedFile.potentialIssues = issues;
    processedFile.metadata.title = (props as any).Title;
    processedFile.metadata.author = (props as any).Author;
    processedFile.metadata.subject = (props as any).Subject;
    processedFile.metadata.creator = (props as any).Creator;
    processedFile.metadata.company = (props as any).Company;
    processedFile.metadata.lastModifiedBy = (props as any).LastAuthor;
    processedFile.metadata.creationDate = (props as any).CreatedDate?.toISOString?.();
    processedFile.metadata.modificationDate = (props as any).ModifiedDate?.toISOString?.();
  }
  // Content scan: iterate sheets, scan cell text and hyperlinks
  try {
    const emailPages = new Map<string, Set<number>>();
    const urlPages = new Map<string, Set<number>>();
    const ackMap = new Map<string, Set<number>>();
    const affMap = new Map<string, Set<number>>();

    const sheetNames = workbook.SheetNames;
    for (let idx = 0; idx < sheetNames.length; idx++) {
      const name = sheetNames[idx];
      const page = idx + 1; // treat sheet index as page number
      const sheet: any = (workbook as any).Sheets[name];
      if (!sheet) continue;
      const collectedSegments: string[] = [];

      // Scan cell values
      for (const addr of Object.keys(sheet)) {
        if (addr.startsWith('!')) continue; // skip special keys
        const cell = sheet[addr];
        const textVal = (typeof cell?.w === 'string' && cell.w) || (typeof cell?.v === 'string' && cell.v) || '';
        if (textVal) {
          collectedSegments.push(String(textVal));
          scanTextForEmailsAndUrls(String(textVal), (value, kind) => {
            if (kind === 'email') {
              if (!emailPages.has(value)) emailPages.set(value, new Set());
              emailPages.get(value)!.add(page);
            } else {
              if (!urlPages.has(value)) urlPages.set(value, new Set());
              urlPages.get(value)!.add(page);
            }
          });
          // Research findings
          const t = String(textVal);
          if (ACK_HEADERS_RE.test(t)) addFinding(ackMap, t, page);
          if (AFFIL_HEADER_RE.test(t) || AFFIL_CUES_RE.test(t)) addFinding(affMap, t, page);
        }

        // Hyperlinks on cells (SheetJS puts them in cell.l)
        const link = cell?.l?.Target as string | undefined;
        if (link) {
          if (/^mailto:/i.test(link)) {
            const addr = decodeURIComponent(link.replace(/^mailto:/i, '').split('?')[0]);
            if (addr) {
              if (!emailPages.has(addr)) emailPages.set(addr, new Set());
              emailPages.get(addr)!.add(page);
            }
          } else {
            scanTextForEmailsAndUrls(String(link), (value, kind) => {
              if (kind === 'email') {
                if (!emailPages.has(value)) emailPages.set(value, new Set());
                emailPages.get(value)!.add(page);
              } else {
                if (!urlPages.has(value)) urlPages.set(value, new Set());
                urlPages.get(value)!.add(page);
              }
            });
            const lt = String(link);
            if (ACK_HEADERS_RE.test(lt)) addFinding(ackMap, lt, page);
          if (AFFIL_HEADER_RE.test(lt) || AFFIL_CUES_RE.test(lt)) addFinding(affMap, lt, page);
          }
        }
      }
    }

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

    await annotateMetadataWithNamedEntities(processedFile.metadata);
  } catch (e) {
    console.warn('XLSX content scan skipped:', e);
  }

  return processedFile;
}
