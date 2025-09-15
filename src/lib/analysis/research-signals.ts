// ---- Research signals (Acknowledgements / Funding / Affiliations) ----
export type ResearchSignals = {
  acknowledgementsDetected: boolean;
  acknowledgementsExcerpt?: string;
  fundingDetected: boolean;
  fundingMentions?: string[];
  grantIds?: string[];
  affiliationsDetected: boolean;
  affiliationsGuesses?: string[];
};

export const ACK_HEADERS_RE = /\b(acknowledg(?:e)?ments?|acknowledgment|acknowledgements)\b/i;
// Note: We intentionally do NOT use phrase-based detection for acknowledgements.
// Acknowledgements should only be detected when an explicit section/header exists.
// const ACK_PHRASES_RE = /\b(we\s+(?:thank|acknowledge)|i\s+thank|the\s+authors\s+(?:thank|acknowledge))\b/i;
// Note: Funding header regex was unused; remove to avoid unused var warnings.
const FUND_PHRASES_RE = /\b(this\s+(?:work|research)\s+(?:was\s+)?(?:supported|funded|sponsored)\s+by|we\s+(?:acknowledge|thank).{0,60}\b(?:funding|support)|\b(?:grant|award|contract)\s*(?:no\.|number|#)?\s*[:\-]?\s*[A-Z]{0,4}\d[\w\-/.]{3,}\b|\b(NIH|NSF|ERC|Horizon\s*2020|Wellcome\s*Trust|UKRI|DFG|NSFC|DARPA|ONR|DoD|DOE|EU|NERC|EPSRC|NIHR)\b)/i;
const GRANT_ID_RE = /\b(?:grant|award|contract)\s*(?:no\.|number|#)?\s*[:\-]?\s*([A-Z]{0,4}\d[\w\-/]{3,})/gi;
export const AFFIL_HEADER_RE = /\b(affiliation|affiliations|author\s+information)\b/i;
export const AFFIL_CUES_RE = /\b(University|College|Institute|Department|Laborator(?:y|ies)|Hospital|Center|Centre|School|Faculty|Company|Inc\.|Ltd\.|LLC|GmbH|CNRS|Max\s*Planck|Oxford|Cambridge|Harvard|Stanford|MIT|Caltech|ETH|Tsinghua|Peking|National\s+Laboratory)\b/i;

export function extractContextSnippet(text: string, index: number, window = 220): string {
  const start = Math.max(0, index - Math.floor(window / 2));
  const end = Math.min(text.length, index + Math.floor(window / 2));
  const snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return (start > 0 ? '… ' : '') + snippet + (end < text.length ? ' …' : '');
}

export function scanResearchSignals(rawText: string): ResearchSignals {
  const text = (rawText || '').replace(/\u00AD/g, '').replace(/\s+/g, ' '); // soft hyphens, collapse spaces
  const signals: ResearchSignals = {
    acknowledgementsDetected: false,
    fundingDetected: false,
    affiliationsDetected: false,
  };

  // Acknowledgements
  // Only consider explicit acknowledgements headers, not generic phrases
  let m = text.match(ACK_HEADERS_RE);
  if (m && m.index !== undefined) {
    signals.acknowledgementsDetected = true;
    signals.acknowledgementsExcerpt = extractContextSnippet(text, m.index);
  }

  // Funding
  const fundingHits: string[] = [];
  let foundIdx = -1;
  const fundRe = new RegExp(FUND_PHRASES_RE.source, 'gi');
  let fm: RegExpExecArray | null;
  while ((fm = fundRe.exec(text)) !== null) {
    const idx = fm.index || 0;
    if (foundIdx === -1) foundIdx = idx;
    fundingHits.push(extractContextSnippet(text, idx));
  }
  if (fundingHits.length) {
    signals.fundingDetected = true;
    signals.fundingMentions = Array.from(new Set(fundingHits)).slice(0, 6);
  }
  const grantIds: string[] = [];
  let gm: RegExpExecArray | null;
  while ((gm = GRANT_ID_RE.exec(text)) !== null) {
    if (gm[1]) grantIds.push(gm[1]);
  }
  if (grantIds.length) signals.grantIds = Array.from(new Set(grantIds)).slice(0, 10);

  // Affiliations: bias to the beginning (author block)
  const firstChunk = text.slice(0, Math.min(15000, text.length));
  const sentences = firstChunk.split(/(?<=[.!?])\s+/);
  const affs = sentences.filter((s) => AFFIL_HEADER_RE.test(s) || AFFIL_CUES_RE.test(s));
  if (affs.length) {
    signals.affiliationsDetected = true;
    signals.affiliationsGuesses = Array.from(new Set(affs.map((s) => s.replace(/\s+/g, ' ').trim()))).slice(0, 8);
  }

  return signals;
}

// Helper for accumulating research findings with locations
export function addFinding(map: Map<string, Set<number>>, key: string, page: number) {
  // Normalize for de-duplication across sentence vs context snippets
  const normalize = (s: string) => {
    let out = (s || '')
      .replace(/\u00AD/g, '') // soft hyphen
      .replace(/\s+/g, ' ')
      .trim();
    // Strip leading/trailing ellipsis characters or "..."
    out = out.replace(/^(?:…|\.\.\.)\s*/, '');
    out = out.replace(/\s*(?:…|\.\.\.)$/, '');
    // Trim surrounding quotes if present
    out = out.replace(/^['"“”‘’]+\s*/, '').replace(/\s*['"“”‘’]+$/, '');
    return out;
  };

  const k = normalize(key);
  if (!k) return;
  if (!map.has(k)) map.set(k, new Set());
  map.get(k)!.add(page);
}
