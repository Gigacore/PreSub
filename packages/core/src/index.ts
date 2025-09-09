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

// --- OLE2/CFB helpers (for .doc/.xls/.ppt) ---
function isOle(buf: Uint8Array): boolean {
  if (buf.length < 8) return false;
  const b = buf as any as Buffer;
  return b.readUInt32LE(0) === 0xE011CFD0 && b.readUInt32LE(4) === 0xE11AB1A1;
}

type OleHeader = {
  sectorSize: number;
  shortSectorSize: number;
  numFatSectors: number;
  dirStart: number;
  miniStreamCutoff: number;
  miniFatStart: number;
  miniFatCount: number;
  difatStart: number;
  difatCount: number;
  difat: number[];
};

const ENDOFCHAIN = 0xFFFFFFFE >>> 0;
const FREESECT = 0xFFFFFFFF >>> 0;
const FATSECT = 0xFFFFFFFD >>> 0;
const DIFSECT = 0xFFFFFFFC >>> 0;

function parseOleHeader(buf: Buffer): OleHeader | null {
  if (buf.length < 512) return null;
  const sectorSize = 1 << buf.readUInt16LE(0x1E);
  const shortSectorSize = 1 << buf.readUInt16LE(0x20);
  const numFatSectors = buf.readUInt32LE(0x2C);
  const dirStart = buf.readUInt32LE(0x30);
  const miniStreamCutoff = buf.readUInt32LE(0x38);
  const miniFatStart = buf.readUInt32LE(0x3C);
  const miniFatCount = buf.readUInt32LE(0x40);
  const difatStart = buf.readUInt32LE(0x44);
  const difatCount = buf.readUInt32LE(0x48);
  const difat: number[] = [];
  for (let i = 0; i < 109; i++) {
    const v = buf.readUInt32LE(0x4C + i * 4);
    if (v !== FREESECT) difat.push(v >>> 0);
  }
  return { sectorSize, shortSectorSize, numFatSectors, dirStart, miniStreamCutoff, miniFatStart, miniFatCount, difatStart, difatCount, difat };
}

function sectorOffset(sector: number, sectorSize: number): number {
  return 512 + sector * sectorSize;
}

function buildFat(buf: Buffer, header: OleHeader): Uint32Array | null {
  const { sectorSize } = header;
  const fatSectors: number[] = [...header.difat];
  // Follow DIFAT chain if present
  let next = header.difatStart >>> 0;
  for (let i = 0; i < header.difatCount && next !== ENDOFCHAIN && next !== FREESECT; i++) {
    const off = sectorOffset(next, sectorSize);
    if (off + sectorSize > buf.length) break;
    // Each DIFAT sector has (sectorSize/4 - 1) DIFAT entries + next pointer at end
    const entries = (sectorSize / 4) - 1;
    for (let j = 0; j < entries; j++) {
      const v = buf.readUInt32LE(off + j * 4);
      if (v !== FREESECT) fatSectors.push(v >>> 0);
    }
    next = buf.readUInt32LE(off + entries * 4) >>> 0;
  }
  // Assemble FAT table
  // Determine how many sectors are in the file
  const totalSectors = Math.floor((buf.length - 512) / sectorSize);
  const FAT = new Uint32Array(totalSectors);
  FAT.fill(FREESECT);
  // Fill FAT using the logical order from DIFAT list
  for (let k = 0; k < fatSectors.length; k++) {
    const s = fatSectors[k];
    const off = sectorOffset(s, sectorSize);
    if (off + sectorSize > buf.length) continue;
    const entries = sectorSize / 4;
    for (let i = 0; i < entries; i++) {
      const v = buf.readUInt32LE(off + i * 4) >>> 0;
      const sectorIndex = i + (k * entries);
      if (sectorIndex < FAT.length) FAT[sectorIndex] = v;
    }
  }
  return FAT;
}

function readChain(buf: Buffer, start: number, sectorSize: number, FAT: Uint32Array): Buffer {
  const chunks: Buffer[] = [];
  let s = start >>> 0;
  const maxIter = FAT.length + 1;
  let iter = 0;
  while (s !== ENDOFCHAIN && s !== FREESECT && iter++ < maxIter) {
    const off = sectorOffset(s, sectorSize);
    const end = off + sectorSize;
    if (end > buf.length) break;
    chunks.push(buf.subarray(off, end));
    s = FAT[s] >>> 0;
  }
  return Buffer.concat(chunks);
}

type DirEntry = { name: string; type: number; start: number; size: number };

function parseDirectory(buf: Buffer, header: OleHeader, FAT: Uint32Array): DirEntry[] {
  const dirStream = readChain(buf, header.dirStart >>> 0, header.sectorSize, FAT);
  const entries: DirEntry[] = [];
  const entrySize = 128;
  for (let off = 0; off + entrySize <= dirStream.length; off += entrySize) {
    const nameLen = dirStream.readUInt16LE(off + 0x40);
    if (nameLen < 2) continue;
    const rawName = dirStream.subarray(off + 0x00, off + 0x00 + nameLen - 2);
    const name = rawName.toString('utf16le');
    const type = dirStream.readUInt8(off + 0x42);
    const start = dirStream.readUInt32LE(off + 0x74) >>> 0;
    const size = dirStream.readUInt32LE(off + 0x78) >>> 0;
    entries.push({ name, type, start, size });
  }
  return entries;
}

function buildMiniFat(buf: Buffer, header: OleHeader, FAT: Uint32Array): Uint32Array | null {
  if (header.miniFatStart === FREESECT || header.miniFatCount === 0) return null;
  const miniFatStream = readChain(buf, header.miniFatStart >>> 0, header.sectorSize, FAT);
  const count = (miniFatStream.length / 4) | 0;
  const miniFAT = new Uint32Array(count);
  for (let i = 0; i < count; i++) miniFAT[i] = miniFatStream.readUInt32LE(i * 4) >>> 0;
  return miniFAT;
}

function readMiniStreamContainer(buf: Buffer, header: OleHeader, FAT: Uint32Array, root: DirEntry | undefined): Buffer | null {
  if (!root) return null;
  return readChain(buf, root.start >>> 0, header.sectorSize, FAT).subarray(0, root.size);
}

function readMiniChain(container: Buffer, start: number, shortSectorSize: number, miniFAT: Uint32Array): Buffer {
  const chunks: Buffer[] = [];
  let s = start >>> 0;
  const maxIter = miniFAT.length + 1;
  let iter = 0;
  while (s !== ENDOFCHAIN && s !== FREESECT && iter++ < maxIter) {
    const off = s * shortSectorSize;
    const end = off + shortSectorSize;
    if (end > container.length) break;
    chunks.push(container.subarray(off, end));
    s = miniFAT[s] >>> 0;
  }
  return Buffer.concat(chunks);
}

function readStreamFromEntry(buf: Buffer, header: OleHeader, FAT: Uint32Array, miniFAT: Uint32Array | null, miniContainer: Buffer | null, entry: DirEntry): Buffer | null {
  if (entry.size === 0) return Buffer.alloc(0);
  if (entry.size < header.miniStreamCutoff && miniFAT && miniContainer) {
    const data = readMiniChain(miniContainer, entry.start >>> 0, header.shortSectorSize, miniFAT);
    return data.subarray(0, entry.size);
  }
  const data = readChain(buf, entry.start >>> 0, header.sectorSize, FAT);
  return data.subarray(0, entry.size);
}

function parsePropertySet(stream: Buffer): Record<number, string> {
  const props: Record<number, string> = {};
  if (stream.length < 48) return props;
  const littleEndian = stream.readUInt16LE(0) === 0xFFFE;
  if (!littleEndian) return props;
  const numSections = stream.readUInt32LE(0x1C);
  if (numSections < 1) return props;
  const sectionOffset = stream.readUInt32LE(0x2C);
  if (sectionOffset + 8 > stream.length) return props;
  const propCount = stream.readUInt32LE(sectionOffset);
  const tableOffset = sectionOffset + 4;
  const entries: { id: number; offset: number }[] = [];
  for (let i = 0; i < propCount; i++) {
    const id = stream.readUInt32LE(tableOffset + i * 8);
    const off = stream.readUInt32LE(tableOffset + i * 8 + 4);
    entries.push({ id, offset: sectionOffset + off });
  }
  for (const e of entries) {
    if (e.offset + 8 > stream.length) continue;
    const vt = stream.readUInt32LE(e.offset) & 0xFFFF; // type in low 16 bits
    const valOff = e.offset + 4; // skip type (and padding)
    if (vt === 0x1F) { // VT_LPWSTR
      if (valOff + 4 > stream.length) continue;
      const cb = stream.readUInt32LE(valOff);
      const strBytes = stream.subarray(valOff + 4, valOff + 4 + cb);
      let s = strBytes.toString('utf16le');
      s = s.replace(/\u0000+$/g, '');
      props[e.id] = s;
    } else if (vt === 0x1E) { // VT_LPSTR
      if (valOff + 4 > stream.length) continue;
      const cb = stream.readUInt32LE(valOff);
      const strBytes = stream.subarray(valOff + 4, valOff + 4 + cb);
      let s = strBytes.toString('latin1');
      s = s.replace(/\u0000+$/g, '').replace(/\x00+$/g, '');
      props[e.id] = s;
    }
  }
  return props;
}

function extractOleMetadata(buf: Uint8Array): { Title?: string; Author?: string; LastAuthor?: string } {
  const b = Buffer.from(buf);
  const header = parseOleHeader(b);
  if (!header) return {};
  const FAT = buildFat(b, header);
  if (!FAT) return {};
  const dirEntries = parseDirectory(b, header, FAT);
  const root = dirEntries.find(d => d.name.replace(/\u0000+$/, '') === 'Root Entry');
  const miniFAT = buildMiniFat(b, header, FAT);
  const miniContainer = readMiniStreamContainer(b, header, FAT, root);
  // Find SummaryInformation stream
  const sum = dirEntries.find(d => d.name.replace(/\u0000+$/, '') === '\u0005SummaryInformation');
  if (!sum) return {};
  const stream = readStreamFromEntry(b, header, FAT, miniFAT, miniContainer, sum);
  if (!stream) return {};
  const props = parsePropertySet(stream);
  const out: { Title?: string; Author?: string; LastAuthor?: string } = {};
  // PIDSI_TITLE = 0x02, PIDSI_AUTHOR = 0x04, PIDSI_LASTAUTHOR = 0x08
  if (props[0x02]) out.Title = props[0x02];
  if (props[0x04]) out.Author = props[0x04];
  if (props[0x08]) out.LastAuthor = props[0x08];
  return out;
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
          const title = properties['dc:title'];
          if (title) {
            result.info.push({
              id: 'title',
              description: 'The title of the document.',
              value: title,
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

    // Handle legacy OLE (doc/xls/ppt)
    if (!mime && isOle(buf)) {
      const meta = extractOleMetadata(buf);
      if (meta.Author) {
        result.critical.push({ id: 'author', description: 'The author of the document.', value: meta.Author });
      }
      if (meta.Title) {
        result.info.push({ id: 'title', description: 'The title of the document.', value: meta.Title });
      }
      if (meta.LastAuthor) {
        result.warning.push({ id: 'lastModifiedBy', description: 'The person who last modified the document.', value: meta.LastAuthor });
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
