import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
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
    const result = await mammoth.extractRawText({ arrayBuffer });
    processedFile.metadata.wordCount = result.value.split(/\s+/).length;
  } catch (e) {
    console.error('Error parsing docx:', e);
    processedFile.metadata.error = 'Could not parse .docx file';
  }

  return processedFile;
}

async function parseXlsx(file: File): Promise<ProcessedFile> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer);
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
  return {
    fileName: file.name,
    metadata: {
      fileType: 'Microsoft PowerPoint Presentation',
      note: 'Metadata extraction for PowerPoint files is not yet supported.',
    },
  };
}

export async function parseFile(file: File): Promise<ProcessedFile> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return parsePdf(file);
    case 'docx':
    case 'doc':
      return parseDocx(file);
    case 'xlsx':
    case 'xls':
      return parseXlsx(file);
    case 'pptx':
    case 'ppt':
      return parsePptx(file);
    default:
      return {
        fileName: file.name,
        metadata: {
          error: 'Unsupported file type',
        },
      };
  }
}
