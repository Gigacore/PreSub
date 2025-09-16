import type { ProcessedFile } from '../../App';
import {
  extractExifMetadata,
  extractXmpMetadataFromXml,
  extractXmpXmlFromBuffer,
  extractPngTextChunks,
} from '../utils/image';
import { shouldFlagPersonValue } from '../analysis/nlp';

export async function parsePng(file: File): Promise<ProcessedFile> {
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
    const all = (processedFile.metadata as any).__exifAll as Record<string, string | number | boolean | null> | undefined;
    if (all && Object.keys(all).length) {
      (processedFile as any).exif = all;
    }
    delete (processedFile.metadata as any).__exifAll;

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
    if (author && (await shouldFlagPersonValue(author))) issues.push({ type: 'AUTHOR FOUND', value: author });
    if (creator && (await shouldFlagPersonValue(creator))) {
      issues.push({ type: 'CREATOR FOUND', value: creator });
    }
    if (issues.length) processedFile.potentialIssues = issues;
  } catch (e) {
    console.warn('PNG parse warning:', e);
  }

  return processedFile;
}
