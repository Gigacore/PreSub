import type { ProcessedFile } from '../../App';
import {
  extractExifMetadata,
  extractXmpMetadataFromXml,
  extractXmpXmlFromBuffer,
} from '../utils/image';
import { shouldFlagPersonValue } from '../analysis/nlp';

export async function parseTiff(file: File): Promise<ProcessedFile> {
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
    const all = (processedFile.metadata as any).__exifAll as Record<string, string | number | boolean | null> | undefined;
    if (all && Object.keys(all).length) {
      (processedFile as any).exif = all;
    }
    delete (processedFile.metadata as any).__exifAll;

    // Prefer XMP scan (present as tag 700, but scanning for XML works too)
    const xmpXml = extractXmpXmlFromBuffer(arrayBuffer);
    if (xmpXml) {
      const meta = extractXmpMetadataFromXml(xmpXml);
      Object.assign(processedFile.metadata, meta);
    }

    const issues: NonNullable<ProcessedFile['potentialIssues']> = [];
    const author = String((processedFile.metadata as any).author || '').trim();
    const creator = String((processedFile.metadata as any).creator || '').trim();
    if (author && (await shouldFlagPersonValue(author))) issues.push({ type: 'AUTHOR FOUND', value: author });
    if (creator && (await shouldFlagPersonValue(creator))) {
      issues.push({ type: 'CREATOR FOUND', value: creator });
    }
    if (issues.length) processedFile.potentialIssues = issues;

    if (!xmpXml) {
      processedFile.metadata.note = 'Basic TIFF metadata not parsed (XMP only)';
    }
  } catch (e) {
    console.warn('TIFF parse warning:', e);
  }

  return processedFile;
}
