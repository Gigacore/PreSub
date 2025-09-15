// Pluggable text scanner with optional WASM override
// Default JS implementation finds emails and URLs.

export type ScanKind = 'email' | 'url';
export type OnScanMatch = (value: string, kind: ScanKind) => void;

let wasmScanImpl: ((text: string, onMatch: OnScanMatch) => void) | null = null;

export function setWasmScanner(fn: (text: string, onMatch: OnScanMatch) => void) {
  wasmScanImpl = fn;
}

export function scanTextForEmailsAndUrls(text: string, onMatch: OnScanMatch) {
  if (wasmScanImpl) return wasmScanImpl(text, onMatch);
  return jsScan(text, onMatch);
}

function jsScan(text: string, onMatch: OnScanMatch) {
  const src = text;
  // Pragmatic email pattern
  const emailRe = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}/gi;
  let m: RegExpExecArray | null;
  while ((m = emailRe.exec(src)) !== null) {
    onMatch(m[0], 'email');
  }

  // URL patterns: with scheme, with www, or bare domain with path
  const urlRe = /(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)|(\bwww\.[\w\-._~:/?#[\]@!$&'()*+,;=%]+)|(\b[\w.-]+\.(?:com|org|net|edu|io|co|ai|app|dev|tech|info|xyz)(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+)?)/gi;
  let u: RegExpExecArray | null;
  while ((u = urlRe.exec(src)) !== null) {
    // Choose the matched group
    const raw = u[1] || u[2] || u[3] || u[0];
    // Avoid emails already captured
    if (/@/.test(raw)) continue;
    onMatch(raw.replace(/[.,;:!?"')\]]+$/, ''), 'url');
  }
}

