import JSZip from 'jszip';
import * as xml2js from 'xml2js';
import * as xmljs from 'xml-js';

export interface AnalysisResult {
  critical: { id: string; description: string; value: string }[];
  warning: { id: string; description: string; value: string }[];
  info: { id: string; description: string; value: string }[];
}

// --- PDF helpers ---
function isPdf(buf: Uint8Array): boolean {
  // %PDF-
  return (
    buf.length >= 5 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46 &&
    buf[4] === 0x2d
  );
}

function decodePdfLiteralString(str: string): string {
  // Remove surrounding parentheses and unescape simple sequences
  if (str.startsWith('(') && str.endsWith(')')) {
    let s = str.slice(1, -1);
    // Handle escaped parens and backslashes first
    s = s.replace(/\\\)/g, ')').replace(/\\\(/g, '(').replace(/\\\\/g, '\\');
    // Handle common escapes
    s = s
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\b/g, '\b')
      .replace(/\\f/g, '\f');
    // Basic octal escapes \ddd
    s = s.replace(/\\([0-7]{1,3})/g, (_m, oct) => String.fromCharCode(parseInt(oct, 8)));
    return s;
  }
  return str;
}

function decodePdfHexString(str: string): string {
  // Remove <...>
  const hex = str.replace(/[<>\s]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    const byte = hex.substr(i, 2);
    if (byte.length === 2) bytes.push(parseInt(byte, 16));
  }
  if (bytes.length >= 2 && (bytes[0] === 0xFF && bytes[1] === 0xFE)) {
    // UTF-16 LE with BOM
    return Buffer.from(bytes).toString('utf16le');
  }
  if (bytes.length >= 2 && (bytes[0] === 0xFE && bytes[1] === 0xFF)) {
    // UTF-16 BE with BOM -> swap to LE then decode
    const swapped: number[] = [];
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      swapped.push(bytes[i + 1], bytes[i]);
    }
    return Buffer.from(swapped).toString('utf16le');
  }
  return Buffer.from(bytes).toString('latin1');
}

function normalizePdfDate(d: string): string {
  // Expect formats like D:YYYYMMDDHHmmSSOHH'mm'
  const m = d.match(/D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Zz]|[+\-]\d{2}'?\d{2}'?)?/);
  if (!m) return d;
  const [_, Y, Mo='01', Da='01', H='00', Mi='00', S='00', tz] = m as any;
  const base = `${Y}-${Mo}-${Da} ${H}:${Mi}:${S}`;
  return tz ? `${base} ${tz.replace(/'/g, '')}` : base;
}

function extractPdfMetadata(buf: Uint8Array) {
  const text = Buffer.from(buf).toString('latin1');
  const out: Record<string, string> = {};
  const fields = ['Author','Title','Producer','Creator','CreationDate','ModDate'];

  // Try to locate Info dictionary object (common case)
  // Fallback: global scan for key-value pairs
  const regex = /\/(Author|Title|Producer|Creator|CreationDate|ModDate)\s*(\((?:\\\)|\\\(|[^)])*\)|<[^>]*>)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    const key = match[1];
    const raw = match[2];
    let value = raw.startsWith('(') ? decodePdfLiteralString(raw) : decodePdfHexString(raw);
    if (key === 'CreationDate' || key === 'ModDate') {
      value = normalizePdfDate(value);
    }
    out[key] = value;
  }
  return out;
}

function isZip(buf: Uint8Array): boolean {
  // ZIP signatures: PK\x03\x04, PK\x05\x06, PK\x07\x08
  return (
    buf.length >= 4 &&
    buf[0] === 0x50 && buf[1] === 0x4B && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)
  );
}

export async function analyzeFile(buf: Uint8Array, mime?: string, name?:string): Promise<AnalysisResult> {
  const result: AnalysisResult = { critical: [], warning: [], info: [] };

  try {
    // Prefer explicit mime if provided
    if (mime === 'application/pdf' || (!mime && isPdf(buf))) {
      const meta = extractPdfMetadata(buf);
      if (meta.Author) {
        result.critical.push({ id: 'author', description: 'The author of the PDF.', value: meta.Author });
      }
      if (meta.Title) {
        result.info.push({ id: 'title', description: 'The title of the PDF.', value: meta.Title });
      }
      if (meta.CreationDate) {
        result.info.push({ id: 'creationDate', description: 'The creation date of the PDF.', value: meta.CreationDate });
      }
      if (meta.ModDate) {
        result.info.push({ id: 'modificationDate', description: 'The modification date of the PDF.', value: meta.ModDate });
      }
      if (meta.Producer) {
        result.info.push({ id: 'producer', description: 'The software that created the PDF.', value: meta.Producer });
      }
      if (meta.Creator) {
        result.info.push({ id: 'creator', description: 'The software that created the original document.', value: meta.Creator });
      }
      return result;
    }

    // Handle OOXML (docx/xlsx/pptx)
    if (mime?.includes('zip') || isZip(buf)) {
      const zip = await JSZip.loadAsync(buf);
      const corePropsXml = await zip.file('docProps/core.xml')?.async('string');
      if (corePropsXml) {
        const coreProps = await xml2js.parseStringPromise(corePropsXml, {
          explicitArray: false,
          tagNameProcessors: [tag => tag.replace('cp:', '')],
        });
        const properties = coreProps.coreProperties;
        if (properties) {
          const creator = properties['dc:creator'];
          if (creator) {
            result.critical.push({
              id: 'author',
              description: 'The author of the document.',
              value: creator,
            });
          }

          const lastModifiedBy = properties.lastModifiedBy;
          if (lastModifiedBy) {
            result.warning.push({
              id: 'lastModifiedBy',
              description: 'The person who last modified the document.',
              value: lastModifiedBy,
            });
          }
        }
      }
      return result;
    }
  } catch (error) {
    console.error('Error analyzing file:', error);
  }

  return result;
}

export async function sanitizeFile(buf: Uint8Array, opts?: any): Promise<Uint8Array> {
  try {
    const zip = await JSZip.loadAsync(buf);
    const corePropsXmlPath = 'docProps/core.xml';
    const corePropsXml = await zip.file(corePropsXmlPath)?.async('string');

    if (corePropsXml) {
      const coreProps = await xml2js.parseStringPromise(corePropsXml, {
        explicitArray: false,
        tagNameProcessors: [tag => tag.replace('cp:', '')],
      });

      const properties = coreProps.coreProperties;
      if (properties) {
        if (properties['dc:creator']) {
          delete properties['dc:creator'];
        }
        if (properties.lastModifiedBy) {
          delete properties.lastModifiedBy;
        }
      }

      const builderOptions = {
        compact: true,
        spaces: 2,
      };
      const newCorePropsXml = xmljs.js2xml(coreProps, builderOptions);
      zip.file(corePropsXmlPath, newCorePropsXml);
    }

    return zip.generateAsync({ type: 'uint8array' });
  } catch (error) {
    console.error('Error sanitizing file:', error);
    // Return original buffer on error
    return buf;
  }
}
