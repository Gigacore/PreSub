import type { ProcessedFile } from '../../App';
import { scanTextForEmailsAndUrls } from '../analysis/content-scanner';
import {
  addFinding,
  ACK_HEADERS_RE,
  AFFIL_CUES_RE,
  AFFIL_HEADER_RE,
} from '../analysis/research-signals';
import { escapeRegExp, parseDelimitedLine } from '../utils/text';
import { variance } from '../utils/number';
import {
  extractNamedEntities,
  addEntitiesToAccumulator,
  finalizeAccumulator,
  attachPositionsFromLines,
  NAMED_ENTITY_MODEL_ID,
  type EntityAccumulatorEntry,
} from '../analysis/nlp';

export async function parseCsv(file: File): Promise<ProcessedFile> {
  const text = await file.text();
  const processedFile: ProcessedFile = {
    fileName: file.name,
    metadata: {
      fileType: 'CSV',
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
    // Detect delimiter using first non-empty lines (comma, tab, semicolon, pipe)
    const lines = text.split(/\r?\n/);
    const sample = lines.filter((l) => l.trim().length > 0).slice(0, 20);
    const candidates: Array<{ char: string; name: string }> = [
      { char: ',', name: 'comma' },
      { char: '\t', name: 'tab' },
      { char: ';', name: 'semicolon' },
      { char: '|', name: 'pipe' },
    ];
    let best = candidates[0];
    let bestScore = -1;
    for (const c of candidates) {
      const scores = sample.map((l) => (l.match(new RegExp(escapeRegExp(c.char), 'g')) || []).length);
      const total = scores.reduce((a, b) => a + b, 0);
      const varScore = scores.length ? variance(scores) : 0; // prefer consistency
      const score = total - varScore; // more separators and more consistent
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    const delimiter = best.char;
    (processedFile.metadata as any).delimiter = best.name;

    // Parse rows with a minimal CSV state machine (RFC4180-like, supports quotes)
    const rows: string[][] = [];
    for (const line of lines) {
      const row = parseDelimitedLine(line, delimiter);
      // consider empty trailing newline as no row
      if (row.length === 1 && row[0] === '' && line.trim() === '') continue;
      rows.push(row);
    }

    const numberOfRows = rows.length;
    const numberOfColumns = rows.reduce((m, r) => Math.max(m, r.length), 0);
    // Exclude header row if present
    const headerRowPresent = rows.length > 0 && rows[0].some((c) => /[A-Za-z]/.test(c));
    (processedFile.metadata as any).headerRowPresent = headerRowPresent;
    (processedFile.metadata as any).numberOfRows = Math.max(0, numberOfRows - (headerRowPresent ? 1 : 0));
    (processedFile.metadata as any).numberOfColumns = numberOfColumns;
    // Header detection done above
    if (headerRowPresent) {
      (processedFile.metadata as any).headers = rows[0];
    }

    // Infer simple column types from up to first 50 data rows
    const dataRows = headerRowPresent ? rows.slice(1) : rows;
    const sampleRows = dataRows.slice(0, 50);
    const typeOfCell = (v: string): 'number' | 'boolean' | 'date' | 'string' | 'empty' => {
      const s = v.trim();
      if (!s) return 'empty';
      if (/^(true|false)$/i.test(s)) return 'boolean';
      if (/^[+-]?\d+(?:\.\d+)?$/.test(s)) return 'number';
      // ISO-like or common date formats
      if (/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?/.test(s)) return 'date';
      if (/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(s)) return 'date';
      return 'string';
    };
    const colTypes: string[] = [];
    for (let c = 0; c < numberOfColumns; c++) {
      const counts: Record<string, number> = { number: 0, boolean: 0, date: 0, string: 0, empty: 0 };
      for (const r of sampleRows) {
        const t = typeOfCell(r[c] ?? '');
        counts[t]++;
      }
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
      colTypes.push(best);
    }
    (processedFile.metadata as any).columnTypes = colTypes;

    // Content scanning: scan each row and attribute findings to row index (1-based data rows)
    const emailPages = new Map<string, Set<number>>();
    const urlPages = new Map<string, Set<number>>();
    const ackMap = new Map<string, Set<number>>();
    const affMap = new Map<string, Set<number>>();
    rows.forEach((row, idx) => {
      const page = idx + 1; // treat row number as a page index
      const joined = row.join(' ');
      if (!joined.trim()) return;
      scanTextForEmailsAndUrls(joined, (value, kind) => {
        if (kind === 'email') {
          if (!emailPages.has(value)) emailPages.set(value, new Set());
          emailPages.get(value)!.add(page);
        } else {
          if (!urlPages.has(value)) urlPages.set(value, new Set());
          urlPages.get(value)!.add(page);
        }
      });
      if (ACK_HEADERS_RE.test(joined)) addFinding(ackMap, joined, page);
      if (AFFIL_HEADER_RE.test(joined) || AFFIL_CUES_RE.test(joined)) addFinding(affMap, joined, page);
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
      } catch (e) {
        nlpAnyFailure = true;
        if (!nlpErrorMessage) nlpErrorMessage = e instanceof Error ? e.message : String(e);
      }
    }

    const emailList = Array.from(emailPages.keys());
    const urlList = Array.from(urlPages.keys());
    if (emailList.length) (processedFile.metadata as any).emailsFound = emailList;
    if (urlList.length) (processedFile.metadata as any).urlsFound = urlList;
    const entityFindings = finalizeAccumulator(entityAccumulator);
    const rowStrings = rows.map((row) => row.join(' '));
    const enrichedEntities = attachPositionsFromLines(entityFindings, rowStrings);
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
        contentFindings.entityPositionLabel = 'Rows';
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
    console.warn('CSV parse warning:', e);
    (processedFile.metadata as any).error = 'Could not parse CSV content';
  }

  return processedFile;
}
