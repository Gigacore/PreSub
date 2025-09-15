export function scanTextForEmailsAndUrls(
  text: string,
  onMatch: (value: string, kind: 'email' | 'url') => void
) {
  const normalizeForUrlScan = (s: string) => {
    let out = s;
    out = out.replace(/(https?|ftp)\s*:\s*\/\s*\//gi, '$1://');
    out = out.replace(/\b(https?|ftp)\s*:\s*/gi, '$1:');
    out = out.replace(/([A-Za-z0-9%~_+\-])\s*\.\s*([A-Za-z0-9%~_+\-])/g, '$1.$2');
    out = out.replace(/([A-Za-z0-9%~_+\-.])\s*\/\s*([A-Za-z0-9%~_+\-.])/g, '$1/$2');
    out = out.replace(/\?\s*/g, '?');
    out = out.replace(/&\s*/g, '&');
    out = out.replace(/=\s*/g, '=');
    out = out.replace(/#\s*/g, '#');
    return out;
  };

  const source = normalizeForUrlScan(text);

  const stripTrailing = (s: string) => {
    let out = s.trim();
    const count = (r: RegExp) => (out.match(r)?.length ?? 0);
    while (out.length) {
      const last = out[out.length - 1];
      if (last === ')') {
        if (count(/\(/g) < count(/\)/g)) {
          out = out.slice(0, -1);
          continue;
        }
      }
      if (/[.,;:!?…'"”’›»)\]]/.test(last)) {
        out = out.slice(0, -1);
        continue;
      }
      break;
    }
    return out;
  };

  const allMatches: { value: string; kind: 'email' | 'url'; start: number; end: number }[] = [];

  // 1. Find all potential URL matches first.
  const urlPatterns: RegExp[] = [
    /(https?:\/\/|ftp:\/\/)[^\s<>"'`{}|\\^\[\]]+/gi, // URLs with protocol
    /\bwww\.[A-Za-z0-9.-]+(?:\/[^\s<>"'`{}|\\\[\]]*)?/gi, // www.something.com
    /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63})(?:\/[^^\s<>"'`{}|\\\[\]]+)/gi, // bare domain with path
  ];

  for (const re of urlPatterns) {
    let match;
    while ((match = re.exec(source)) !== null) {
      allMatches.push({
        value: stripTrailing(match[0]),
        kind: 'url',
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // 2. Find all potential email matches.
  const emailRe = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi;
  let match;
  while ((match = emailRe.exec(source)) !== null) {
    allMatches.push({
      value: stripTrailing(match[0]),
      kind: 'email',
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  // 3. Filter out overlapping/contained matches.
  allMatches.sort((a, b) => a.start - b.start || b.end - a.end);

  const finalMatches: typeof allMatches = [];
  let lastEnd = -1;

  for (const current of allMatches) {
    if (current.start >= lastEnd) {
      // If an email is fully contained in a URL that starts at the same position, prefer the URL.
      if (current.kind === 'email') {
        const containingUrl = finalMatches.find(
          (m) => m.kind === 'url' && m.start === current.start && m.end >= current.end
        );
        if (containingUrl) continue;
      }
      finalMatches.push(current);
      lastEnd = current.end;
    }
  }

  // 4. Call the callback
  for (const m of finalMatches) {
    onMatch(m.value, m.kind);
  }
}
