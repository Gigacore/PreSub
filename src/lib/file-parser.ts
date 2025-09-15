import type { ProcessedFile } from '../App';
import { parseCsv } from './parsers/csv';
import { parseDocx } from './parsers/docx';
import { parseJson } from './parsers/json';
import { parseMarkdown } from './parsers/markdown';
import { parsePdf } from './parsers/pdf';
import { parsePptx } from './parsers/pptx';
import { parseXlsx } from './parsers/xlsx';
import { parseJpeg } from './parsers/jpeg';
import { parsePng } from './parsers/png';
import { parseSvg } from './parsers/svg';
import { parseTiff } from './parsers/tiff';

export async function parseFile(file: File): Promise<ProcessedFile> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'csv':
      return parseCsv(file);
    case 'md':
    case 'markdown':
      return parseMarkdown(file);
    case 'json':
      return parseJson(file);
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
