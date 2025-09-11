import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import type { ProcessedFile } from '../App';
import * as ExifReader from 'exifreader';

// It's important to set the worker source for pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.mjs`;

async function parsePdf(file: File): Promise<ProcessedFile> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument(arrayBuffer).promise;
  const metadata = await pdf.getMetadata();

  const processedFile: ProcessedFile = {
    fileName: file.name,
    metadata: {
      pages: pdf.numPages,
    },
  };

  // Track issues found across metadata and content
  const issues: NonNullable<ProcessedFile['potentialIssues']> = [];

  if (metadata.info) {
    const info = metadata.info as any; // pdfjs-dist types are not perfect
    const author = typeof info.Author === 'string' ? info.Author.trim() : '';
    const creator = typeof info.Creator === 'string' ? info.Creator.trim() : '';

    if (author) {
      issues.push({ type: 'AUTHOR FOUND', value: author });
    }
    if (creator) {
      issues.push({ type: 'CREATOR FOUND', value: creator });
    }
    processedFile.metadata.title = info.Title;
    processedFile.metadata.author = info.Author;
    processedFile.metadata.subject = info.Subject;
    processedFile.metadata.creator = info.Creator;
    processedFile.metadata.producer = info.Producer;
    processedFile.metadata.creationDate = info.CreationDate;
    processedFile.metadata.modificationDate = info.ModDate;
  }

  // Extract textual content to scan for emails and URLs (with page numbers)
  try {
    const emailPages = new Map<string, Set<number>>();
    const urlPages = new Map<string, Set<number>>();

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc: any = await page.getTextContent();
      const text = (tc.items || [])
        .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
        .join(' ');

      scanTextForEmailsAndUrls(text, (value, kind) => {
        if (kind === 'email') {
          if (!emailPages.has(value)) emailPages.set(value, new Set());
          emailPages.get(value)!.add(p);
        } else {
          if (!urlPages.has(value)) urlPages.set(value, new Set());
          urlPages.get(value)!.add(p);
        }
      });
    }

    // Summaries for metadata (backwards compatibility)
    const emailList = Array.from(emailPages.keys());
    const urlList = Array.from(urlPages.keys());
    if (emailList.length) {
      processedFile.metadata.emailsFound = emailList;
      // Do not add to potentialIssues; show as info banner instead
    }
    if (urlList.length) {
      processedFile.metadata.urlsFound = urlList;
      // Do not add to potentialIssues; show as info banner instead
    }

    // Detailed findings with page numbers
    if (emailList.length || urlList.length) {
      processedFile.contentFindings = {
        emails: emailList.map((e) => ({ value: e, pages: Array.from(emailPages.get(e)!).sort((a, b) => a - b) })),
        urls: urlList.map((u) => ({ value: u, pages: Array.from(urlPages.get(u)!).sort((a, b) => a - b) })),
      };
    }
  } catch (e) {
    // Text extraction might fail for scanned/image-only PDFs; ignore gracefully
    console.warn('PDF text extraction skipped:', e);
  }

  if (issues.length) processedFile.potentialIssues = issues;

  return processedFile;
}

function scanTextForEmailsAndUrls(
  text: string,
  onMatch: (value: string, kind: 'email' | 'url') => void
) {
  // Normalize spaces around URL punctuation sometimes introduced by PDF extraction
  const normalizeForUrlScan = (s: string) => {
    let out = s;
    // Rejoin protocol separators like 'http : / /' → 'http://'
    out = out.replace(/(https?|ftp)\s*:\s*\/\s*\//gi, '$1://');
    // Tighten spaces around colons after scheme
    out = out.replace(/\b(https?|ftp)\s*:\s*/gi, '$1:');
    // Collapse spaces around dots within tokens: 'edition . cnn . com' → 'edition.cnn.com'
    out = out.replace(/([A-Za-z0-9%~_+\-])\s*\.\s*([A-Za-z0-9%~_+\-])/g, '$1.$2');
    // Collapse spaces around slashes: '/ reports / docs ' → '/reports/docs'
    out = out.replace(/([A-Za-z0-9%~_+\-.])\s*\/\s*([A-Za-z0-9%~_+\-.])/g, '$1/$2');
    // Remove spaces around query/fragment separators
    out = out.replace(/\?\s*/g, '?');
    out = out.replace(/&\s*/g, '&');
    out = out.replace(/=\s*/g, '=');
    out = out.replace(/#\s*/g, '#');
    return out;
  };

  const source = normalizeForUrlScan(text);

  // Improved email detection (common RFC-like, pragmatic)
  const emailRe = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})/gi;
  const emailCheck = new RegExp(emailRe.source, 'i');

  // URL detection: protocol, www., and bare domains
  const urlPatterns: RegExp[] = [
    /(https?:\/\/|ftp:\/\/)[^\s<>"'`{}|\\^\[\]]+/gi,
    /\bwww\.[A-Za-z0-9.-]+(?:\/[^^\s<>"'`{}|\\\[\]]*)?/gi,
    /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63})(?:\/[^^\s<>"'`{}|\\\[\]]*)?/gi,
  ];

  const stripTrailing = (s: string) => {
    let out = s.trim();
    // Remove unmatched closing parentheses and trailing punctuation
    const count = (r: RegExp) => (out.match(r)?.length ?? 0);
    while (out.length) {
      const last = out[out.length - 1];
      if (last === ')') {
        const l = count(/\(/g);
        const r = count(/\)/g);
        if (r > l) { out = out.slice(0, -1); continue; }
      }
      if (/[.,;:!?…'"”’›»)\]]/.test(last)) { out = out.slice(0, -1); continue; }
      break;
    }
    return out;
  };

  let m: RegExpExecArray | null;
  while ((m = emailRe.exec(source)) !== null) {
    onMatch(stripTrailing(m[0]), 'email');
  }

  const tldAllow = [
    'com','org','net','edu','gov','mil','int','io','co','me','ai','app','dev','tech','xyz','info','biz','online','site','shop','blog','news','art','tv','fm','gg','ly','to','la',
    'us','uk','de','fr','es','it','nl','be','at','ch','se','no','fi','dk','pl','cz','sk','hu','ro','bg','gr','pt','ie','is','tr','ru','ua','by','kz',
    'ca','mx','br','ar','cl','pe','uy','au','nz','za','in','sg','hk','tw','jp','kr','cn','vn','th','my','id','ph','sa','ae','qa','kw','bh','om','il'
  ];
  const tldGroup = tldAllow.join('|');
  const extractUrl = (s: string) => {
    const m = s.match(new RegExp(
      `^(?:(?:https?:\\/\\/|ftp:\\/\\/\\/)|(?:www\\.))?[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*\\.(?:${tldGroup})(?:\\/[^\\s<>"'\
` + "`{}|\\\\\\[\\\\\\]]*)?", 'i'));
    return m ? m[0] : null;
  };

  for (const re of urlPatterns) {
    let um: RegExpExecArray | null;
    while ((um = re.exec(source)) !== null) {
      const rawTrim = stripTrailing(um[0]);
      // Skip if this looks like an email (already captured)
      if (emailCheck.test(rawTrim)) continue;

      let extracted = extractUrl(rawTrim);
      if (!extracted) continue;

      // Require a path for bare domains (no scheme and no www)
      const isBare = !/^https?:\/\//i.test(extracted) && !/^ftp:\/\//i.test(extracted) && !/^www\./i.test(extracted);
      if (isBare && !extracted.includes('/')) continue;

      // Trim trailing appended sentence words like ".Deviations" that are not file extensions
      const lastSlash = extracted.lastIndexOf('/');
      const tail = extracted.slice(lastSlash + 1);
      if (/\.[A-Z][a-zA-Z]+$/.test(tail)) {
        extracted = extracted.slice(0, extracted.lastIndexOf('.'));
      }

      onMatch(extracted, 'url');
    }
  }
}

function previewList(items: Set<string>, limit = 5): string {
  const arr = Array.from(items);
  const shown = arr.slice(0, limit).join(', ');
  return arr.length > limit ? `${shown} (+${arr.length - limit} more)` : shown;
}

async function parseDocx(file: File): Promise<ProcessedFile> {
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
      if (author) issues.push({ type: 'AUTHOR FOUND', value: author });
      if (creator) issues.push({ type: 'CREATOR FOUND', value: creator });
      if (lastModifiedBy) issues.push({ type: 'LAST MODIFIED BY FOUND', value: lastModifiedBy });
      if (issues.length) processedFile.potentialIssues = issues;
    } catch (e) {
      // Ignore metadata errors for docx; continue with text extraction
      console.warn('DOCX metadata extraction skipped:', e);
    }

    const result = await mammoth.extractRawText({ arrayBuffer });
    processedFile.metadata.wordCount = result.value.split(/\s+/).length;
  } catch (e) {
    console.error('Error parsing docx:', e);
    processedFile.metadata.error = 'Could not parse .docx file (only .docx supported)';
  }

  return processedFile;
}

async function parseXlsx(file: File): Promise<ProcessedFile> {
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
    if (author) issues.push({ type: 'AUTHOR FOUND', value: author });
    if (creator) issues.push({ type: 'CREATOR FOUND', value: creator });
    if (lastModifiedBy) issues.push({ type: 'LAST MODIFIED BY FOUND', value: lastModifiedBy });
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

  return processedFile;
}

async function parsePptx(file: File): Promise<ProcessedFile> {
  const arrayBuffer = await file.arrayBuffer();
  const processedFile: ProcessedFile = {
    fileName: file.name,
    metadata: {
      fileType: 'Microsoft PowerPoint Presentation',
    },
  };

  try {
    const meta = await extractOOXMLMetadata(arrayBuffer);
    Object.assign(processedFile.metadata, meta);
    const author = typeof meta.author === 'string' ? meta.author.trim() : '';
    const creator = typeof meta.creator === 'string' ? meta.creator.trim() : '';
    const lastModifiedBy = typeof meta.lastModifiedBy === 'string' ? meta.lastModifiedBy.trim() : '';
    const issues: NonNullable<ProcessedFile['potentialIssues']> = [];
    if (author) issues.push({ type: 'AUTHOR FOUND', value: author });
    if (creator) issues.push({ type: 'CREATOR FOUND', value: creator });
    if (lastModifiedBy) issues.push({ type: 'LAST MODIFIED BY FOUND', value: lastModifiedBy });
    if (issues.length) processedFile.potentialIssues = issues;
  } catch (e) {
    console.warn('PPTX metadata extraction failed:', e);
    processedFile.metadata.note = 'Could not extract .pptx metadata';
  }

  return processedFile;
}

export async function parseFile(file: File): Promise<ProcessedFile> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return parsePdf(file);
    case 'docx':
      return parseDocx(file);
    case 'doc':
      return {
        fileName: file.name,
        metadata: {
          error: 'Legacy .doc format not supported. Please convert to .docx.',
        },
      };
    case 'xlsx':
      return parseXlsx(file);
    case 'xls':
      return {
        fileName: file.name,
        metadata: {
          error: 'Legacy .xls format not supported. Please convert to .xlsx.',
        },
      };
    case 'pptx':
      return parsePptx(file);
    case 'ppt':
      return {
        fileName: file.name,
        metadata: {
          error: 'Legacy .ppt format not supported. Please convert to .pptx.',
        },
      };
    case 'jpg':
    case 'jpeg':
      return parseJpeg(file);
    case 'png':
      return parsePng(file);
    case 'svg':
      return parseSvg(file);
    case 'tif':
    case 'tiff':
      return parseTiff(file);
    default:
      return {
        fileName: file.name,
        metadata: {
          error: 'Unsupported file type',
        },
      };
  }
}

// Helpers
async function extractOOXMLMetadata(arrayBuffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);

  const coreXml = await safeReadText(zip, 'docProps/core.xml');
  const appXml = await safeReadText(zip, 'docProps/app.xml');

  const meta: Record<string, string | number | boolean | null | undefined> = {};

  if (coreXml) {
    const core = parseXml(coreXml);
    const map = mapByLocalName(core);
    if (map.title) meta.title = text(map.title);
    if (map.creator) meta.creator = text(map.creator);
    if (map.subject) meta.subject = text(map.subject);
    if (map.description) meta.description = text(map.description);
    if (map.keywords) meta.keywords = text(map.keywords);
    if (map.category) meta.category = text(map.category);
    if (map.lastModifiedBy) meta.lastModifiedBy = text(map.lastModifiedBy);
    if (map.created) meta.creationDate = toISO(text(map.created));
    if (map.modified) meta.modificationDate = toISO(text(map.modified));
    // For consistency with other parsers
    if (!meta.author && map.creator) meta.author = text(map.creator);
  }

  if (appXml) {
    const app = parseXml(appXml);
    const map = mapByLocalName(app);
    if (map.Company) meta.company = text(map.Company);
    if (map.Manager) meta.manager = text(map.Manager);
    if (map.Application) meta.application = text(map.Application);
    if (map.AppVersion) meta.appVersion = text(map.AppVersion);
    if (map.Slides) meta.slides = number(text(map.Slides));
    if (map.Pages) meta.pages = number(text(map.Pages));
    if (map.Words) meta.words = number(text(map.Words));
    if (map.TotalTime) meta.totalTime = number(text(map.TotalTime));
  }

  return meta;
}

async function safeReadText(zip: JSZip, path: string) {
  const file = zip.file(path);
  if (!file) return null;
  try {
    return await file.async('text');
  } catch {
    return null;
  }
}

function parseXml(xml: string) {
  const parser = new DOMParser();
  return parser.parseFromString(xml, 'application/xml');
}

function mapByLocalName(doc: Document) {
  const nodes = doc.getElementsByTagName('*');
  const map: Record<string, Element> = {};
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i] as Element;
    const key = el.localName; // ignore namespaces
    if (!(key in map)) map[key] = el;
  }
  return map as Record<string, Element> & { [k: string]: Element };
}

function text(el?: Element) {
  return el ? (el.textContent || '').trim() : '';
}

function toISO(value: string | undefined) {
  if (!value) return undefined;
  // Handle common EXIF datetime format: YYYY:MM:DD HH:MM:SS
  let v = value.trim();
  const exifMatch = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(v);
  if (exifMatch) {
    const [, y, m, d, hh, mm, ss] = exifMatch;
    v = `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function number(value: string | undefined) {
  const n = value ? Number(value) : NaN;
  return isNaN(n) ? undefined : n;
}

// ============= Image Parsers =============
async function parseJpeg(file: File): Promise<ProcessedFile> {
  const arrayBuffer = await file.arrayBuffer();
  const processedFile: ProcessedFile = {
    fileName: file.name,
    metadata: {
      fileType: 'JPEG Image',
    },
  };

  try {
    // EXIF/IFD
    const exif = await extractExifMetadata(arrayBuffer);
    Object.assign(processedFile.metadata, exif);

    const xmpXml = extractXmpXmlFromBuffer(arrayBuffer);
    if (xmpXml) {
      const meta = extractXmpMetadataFromXml(xmpXml);
      Object.assign(processedFile.metadata, meta);
    }

    const issues: NonNullable<ProcessedFile['potentialIssues']> = [];
    const author = String((processedFile.metadata as any).author || '').trim();
    const creator = String((processedFile.metadata as any).creator || '').trim();
    if (author) issues.push({ type: 'AUTHOR FOUND', value: author });
    if (creator) issues.push({ type: 'CREATOR FOUND', value: creator });
    if (issues.length) processedFile.potentialIssues = issues;
  } catch (e) {
    console.warn('JPEG parse warning:', e);
  }

  return processedFile;
}

async function parsePng(file: File): Promise<ProcessedFile> {
  const arrayBuffer = await file.arrayBuffer();
  const processedFile: ProcessedFile = {
    fileName: file.name,
    metadata: {
      fileType: 'PNG Image',
    },
  };

  try {
    // EXIF, XMP, and textual chunks via ExifReader
    const exif = await extractExifMetadata(arrayBuffer);
    Object.assign(processedFile.metadata, exif);

    // Also parse plain PNG tEXt/iTXt keys and merge (non-destructive)
    const textEntries = extractPngTextChunks(arrayBuffer);
    const mapping: Record<string, string> = {
      Title: 'title',
      Description: 'description',
      Author: 'author',
      Software: 'software',
      Copyright: 'copyright',
      Source: 'source',
      Comment: 'comment',
      'Creation Time': 'creationTime',
    };
    for (const [k, v] of Object.entries(textEntries)) {
      const key = mapping[k] || k.replace(/\s+/g, '').replace(/^(.)/, (m) => m.toLowerCase());
      (processedFile.metadata as any)[key] = v;
    }

    // XMP inside PNG (iTXt or raw scan)
    const xmpXmlFromScan = extractXmpXmlFromBuffer(arrayBuffer);
    if (xmpXmlFromScan) {
      const xmp = extractXmpMetadataFromXml(xmpXmlFromScan);
      Object.assign(processedFile.metadata, xmp);
    }

    const issues: NonNullable<ProcessedFile['potentialIssues']> = [];
    const author = String((processedFile.metadata as any).author || '').trim();
    const creator = String((processedFile.metadata as any).creator || '').trim();
    if (author) issues.push({ type: 'AUTHOR FOUND', value: author });
    if (creator) issues.push({ type: 'CREATOR FOUND', value: creator });
    if (issues.length) processedFile.potentialIssues = issues;
  } catch (e) {
    console.warn('PNG parse warning:', e);
  }

  return processedFile;
}

async function parseSvg(file: File): Promise<ProcessedFile> {
  const text = await file.text();
  const processedFile: ProcessedFile = {
    fileName: file.name,
    metadata: {
      fileType: 'SVG Image',
    },
  };

  try {
    const doc = parseXml(text);
    const titleEl = doc.getElementsByTagName('title')[0];
    const descEl = doc.getElementsByTagName('desc')[0];
    if (titleEl) processedFile.metadata.title = textContent(titleEl);
    if (descEl) processedFile.metadata.description = textContent(descEl);

    // Common attributes seen in SVG editors
    const svgEl = doc.getElementsByTagName('svg')[0];
    if (svgEl) {
      const docname = svgEl.getAttribute('sodipodi:docname') || svgEl.getAttribute('docname');
      if (docname) processedFile.metadata.docName = docname;
      const creatorTool = svgEl.getAttribute('inkscape:version') || svgEl.getAttribute('xmp:CreatorTool');
      if (creatorTool) processedFile.metadata.creatorTool = creatorTool;
    }

    // XMP metadata embedded in <metadata> (RDF)
    const xmpXml = extractXmpXmlFromString(text);
    if (xmpXml) {
      const meta = extractXmpMetadataFromXml(xmpXml);
      Object.assign(processedFile.metadata, meta);
    } else {
      // Fallback: try any <creator> element text
      const creators = doc.getElementsByTagName('*');
      for (let i = 0; i < creators.length; i++) {
        const el = creators[i] as Element;
        if (el.localName === 'creator') {
          const v = textContent(el);
          if (v) {
            processedFile.metadata.author = v;
            break;
          }
        }
      }
    }

    const issues: NonNullable<ProcessedFile['potentialIssues']> = [];
    const author = String((processedFile.metadata as any).author || '').trim();
    const creator = String((processedFile.metadata as any).creator || '').trim();
    if (author) issues.push({ type: 'AUTHOR FOUND', value: author });
    if (creator) issues.push({ type: 'CREATOR FOUND', value: creator });
    if (issues.length) processedFile.potentialIssues = issues;
  } catch (e) {
    console.warn('SVG parse warning:', e);
  }

  return processedFile;
}

async function parseTiff(file: File): Promise<ProcessedFile> {
  const arrayBuffer = await file.arrayBuffer();
  const processedFile: ProcessedFile = {
    fileName: file.name,
    metadata: {
      fileType: 'TIFF Image',
    },
  };

  try {
    // EXIF/IFD
    const exif = await extractExifMetadata(arrayBuffer);
    Object.assign(processedFile.metadata, exif);

    // Prefer XMP scan (present as tag 700, but scanning for XML works too)
    const xmpXml = extractXmpXmlFromBuffer(arrayBuffer);
    if (xmpXml) {
      const meta = extractXmpMetadataFromXml(xmpXml);
      Object.assign(processedFile.metadata, meta);
    }

    const issues: NonNullable<ProcessedFile['potentialIssues']> = [];
    const author = String((processedFile.metadata as any).author || '').trim();
    const creator = String((processedFile.metadata as any).creator || '').trim();
    if (author) issues.push({ type: 'AUTHOR FOUND', value: author });
    if (creator) issues.push({ type: 'CREATOR FOUND', value: creator });
    if (issues.length) processedFile.potentialIssues = issues;

    if (!xmpXml) {
      processedFile.metadata.note = 'Basic TIFF metadata not parsed (XMP only)';
    }
  } catch (e) {
    console.warn('TIFF parse warning:', e);
  }

  return processedFile;
}

// ---- Image helpers ----
function extractXmpXmlFromBuffer(buf: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buf);
  // Decode as Latin-1 to preserve byte values; XMP markers are ASCII
  const s = new TextDecoder('latin1').decode(bytes);
  return extractXmpXmlFromString(s);
}

function extractXmpXmlFromString(s: string): string | null {
  const startIdx = s.indexOf('<x:xmpmeta');
  if (startIdx === -1) return null;
  const endIdx = s.indexOf('</x:xmpmeta>', startIdx);
  if (endIdx === -1) return null;
  return s.substring(startIdx, endIdx + '</x:xmpmeta>'.length);
}

function extractXmpMetadataFromXml(xmpXml: string) {
  const doc = parseXml(xmpXml);
  const map = mapByLocalName(doc);
  const meta: Record<string, string | number | boolean | null | undefined> = {};

  // Dublin Core and common XMP
  if (map.title) meta.title = text(map.title);
  if (map.description) meta.description = text(map.description);
  if (map.creator) {
    // Often wrapped in rdf:Seq; take text content
    const creatorText = text(map.creator);
    if (creatorText) {
      meta.creator = creatorText;
      // Treat as author for highlighting
      meta.author = meta.author || creatorText;
    }
  }
  if (map.rights) meta.rights = text(map.rights);
  if (map.Copyright) meta.copyright = text(map.Copyright);
  if (map.Artist) meta.author = meta.author || text(map.Artist);
  if (map.CreatorTool) meta.creatorTool = text(map.CreatorTool);
  if (map.CreateDate) meta.creationDate = toISO(text(map.CreateDate));
  if (map.ModifyDate) meta.modificationDate = toISO(text(map.ModifyDate));
  if (map.MetadataDate) meta.metadataDate = toISO(text(map.MetadataDate));
  if (map.Credit) meta.credit = text(map.Credit);
  if (map.Source) meta.source = text(map.Source);

  return meta;
}

function extractPngTextChunks(buf: ArrayBuffer): Record<string, string> {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const out: Record<string, string> = {};

  // PNG signature
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < sig.length; i++) {
    if (u8[i] !== sig[i]) return out; // Not a PNG
  }

  let offset = 8; // after signature
  while (offset + 8 <= u8.length) {
    const length = dv.getUint32(offset, false); // big-endian
    const type = String.fromCharCode(
      u8[offset + 4],
      u8[offset + 5],
      u8[offset + 6],
      u8[offset + 7]
    );
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > u8.length) break;

    if (type === 'tEXt') {
      const data = u8.subarray(dataStart, dataEnd);
      // tEXt: Latin-1, keyword\0text
      const idx0 = data.indexOf(0);
      if (idx0 > 0) {
        const key = new TextDecoder('latin1').decode(data.subarray(0, idx0));
        const value = new TextDecoder('latin1').decode(data.subarray(idx0 + 1));
        out[key] = value;
      }
    } else if (type === 'iTXt') {
      const data = u8.subarray(dataStart, dataEnd);
      // iTXt: keyword\0 compressionFlag(1) compressionMethod(1) languageTag\0 translatedKeyword\0 text
      let p = 0;
      const zero = () => data.indexOf(0, p);
      const z0 = zero();
      if (z0 > 0) {
        const keyword = new TextDecoder('utf-8').decode(data.subarray(0, z0));
        p = z0 + 1;
        const compressionFlag = data[p++];
        p++; // compressionMethod (ignored)
        const z1 = data.indexOf(0, p);
        p = (z1 >= 0 ? z1 + 1 : p); // skip languageTag
        const z2 = data.indexOf(0, p);
        p = (z2 >= 0 ? z2 + 1 : p); // skip translatedKeyword
        if (compressionFlag === 0) {
          const text = new TextDecoder('utf-8').decode(data.subarray(p));
          out[keyword] = text;
          // If this is the XMP field and is uncompressed, it's full XML
          if (keyword === 'XML:com.adobe.xmp') {
            // Parse elsewhere by generic scan as well
          }
        }
        // If compressed, we skip (no inflater dependency in-browser)
      }
    }

    // Move past data + CRC
    offset = dataEnd + 4;
    if (type === 'IEND') break;
  }
  return out;
}

function textContent(el: Element) {
  return (el.textContent || '').trim();
}

// Parse EXIF/IFD/XMP via ExifReader
async function extractExifMetadata(arrayBuffer: ArrayBuffer) {
  try {
    // expanded: false returns tag objects; we normalize into string values
    let tags: any;
    try {
      tags = await (ExifReader as any).load(arrayBuffer);
    } catch {
      return {} as Record<string, unknown>;
    }

    const read = (key: string) => {
      const t: any = (tags as any)[key];
      if (!t) return undefined;
      // ExifReader tag has .description for human-readable, .value for raw
      return (typeof t.description !== 'undefined' ? t.description : t.value);
    };

    const meta: Record<string, string | number | boolean | null | undefined> = {};
    const author = (read('Artist') || read('XPAuthor') || read('Author')) as string | undefined;
    const creator = (read('Creator') || read('XPSubject')) as string | undefined;
    const software = read('Software') as string | undefined;
    const imageDesc = (read('ImageDescription') || read('Description') || read('XPComment')) as string | undefined;
    const copyright = (read('Copyright') || read('XPAuthor')) as string | undefined;
    const credit = read('Credit') as string | undefined;
    const source = read('Source') as string | undefined;
    const createDate = (read('DateTimeOriginal') || read('CreateDate') || read('CreationTime')) as string | undefined;
    const modifyDate = (read('ModifyDate') || read('DateTime')) as string | undefined;

    if (author) meta.author = String(author).trim();
    if (creator) meta.creator = String(creator).trim();
    if (software) meta.software = String(software).trim();
    if (imageDesc) meta.description = String(imageDesc).trim();
    if (copyright) meta.copyright = String(copyright).trim();
    if (credit) meta.credit = String(credit).trim();
    if (source) meta.source = String(source).trim();
    if (createDate) meta.creationDate = toISO(String(createDate));
    if (modifyDate) meta.modificationDate = toISO(String(modifyDate));

    return meta;
  } catch (e) {
    console.warn('EXIF parse warning:', e);
    return {} as Record<string, unknown>;
  }
}
