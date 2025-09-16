export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseDelimitedLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          cur += '"';
          i++;
          continue;
        }
        inQuotes = false;
        continue;
      }
      cur += ch;
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function extractFrontMatter(text: string): { data: any; body: string } | null {
  // Must start with --- on its own line
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  const yaml = m[1];
  const body = text.slice(m[0].length);
  const data: Record<string, any> = {};
  // Very light YAML: key: value and key: [a, b], key: [\n - a\n - b\n]
  // This is intentionally simple to avoid deps.
  const lines = yaml.split(/\r?\n/);
  let currentArrayKey: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    // Array item (dash)
    if (currentArrayKey && /^-\s+/.test(line)) {
      (data[currentArrayKey] = data[currentArrayKey] || []).push(line.replace(/^-\s+/, ''));
      continue;
    }
    currentArrayKey = null;
    const kv = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2].trim();
    if (value === '' || value === '|' || value === '>') {
      // Start of block or empty; ignore complex blocks
      continue;
    }
    // Quoted string
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
      value = value.slice(1, -1);
    } else if (value.startsWith('[') && value.endsWith(']')) {
      // Inline array
      const arr = value.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
      data[key] = arr;
      continue;
    } else if (value === '[]') {
      data[key] = [];
      continue;
    } else if (value === null || value === 'null') {
      data[key] = null;
      continue;
    } else if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      data[key] = value;
      continue;
    } else if (/^(true|false)$/i.test(value)) {
      data[key] = /^true$/i.test(value);
      continue;
    } else if (/^\d+(?:\.\d+)?$/.test(value)) {
      data[key] = Number(value);
      continue;
    } else if (value === '|' || value === '>') {
      // Skip block scalars
      continue;
    }
    // Potential start of block list in following lines
    if (value === '') {
      currentArrayKey = key;
      data[key] = [];
      continue;
    }
    data[key] = value;
  }
  return { data, body };
}
