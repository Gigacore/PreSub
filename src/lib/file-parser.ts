import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import type { ProcessedFile } from '../App';

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

  if (metadata.info) {
    const info = metadata.info as any; // pdfjs-dist types are not perfect
    if (info.Author) {
      processedFile.potentialIssue = {
        type: 'POTENTIAL ISSUE: AUTHOR FOUND',
        value: info.Author,
      };
    }
    processedFile.metadata.title = info.Title;
    processedFile.metadata.author = info.Author;
    processedFile.metadata.subject = info.Subject;
    processedFile.metadata.creator = info.Creator;
    processedFile.metadata.producer = info.Producer;
    processedFile.metadata.creationDate = info.CreationDate;
    processedFile.metadata.modificationDate = info.ModDate;
  }

  return processedFile;
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
      const author = (meta.author || meta.creator) as string | undefined;
      if (author) {
        processedFile.potentialIssue = {
          type: 'POTENTIAL ISSUE: AUTHOR FOUND',
          value: author,
        };
      }
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
    if (props.Author) {
      processedFile.potentialIssue = {
        type: 'POTENTIAL ISSUE: AUTHOR FOUND',
        value: props.Author,
      };
    }
    processedFile.metadata.title = props.Title;
    processedFile.metadata.author = props.Author;
    processedFile.metadata.subject = props.Subject;
    processedFile.metadata.creator = props.Creator;
    processedFile.metadata.company = props.Company;
    processedFile.metadata.lastModifiedBy = props.LastAuthor;
    processedFile.metadata.creationDate = props.CreatedDate?.toISOString();
    processedFile.metadata.modificationDate = props.ModifiedDate?.toISOString();
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
    const author = (meta.author || meta.creator) as string | undefined;
    if (author) {
      processedFile.potentialIssue = {
        type: 'POTENTIAL ISSUE: AUTHOR FOUND',
        value: author,
      };
    }
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
    case 'xls':
      return parseXlsx(file);
    case 'pptx':
      return parsePptx(file);
    case 'ppt':
      return {
        fileName: file.name,
        metadata: {
          error: 'Legacy .ppt format not supported. Please convert to .pptx.',
        },
      };
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
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function number(value: string | undefined) {
  const n = value ? Number(value) : NaN;
  return isNaN(n) ? undefined : n;
}
