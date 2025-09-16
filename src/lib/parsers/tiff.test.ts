import { describe, it, expect, vi } from 'vitest';
import { parseTiff } from './tiff';
import * as nlp from '../analysis/nlp';
import * as image from '../utils/image';

vi.mock('../analysis/nlp');
vi.mock('../utils/image');

const createMockFile = (name: string) => {
  return {
    name,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
  } as File;
};

describe('tiff parser', () => {
  it('parses a simple TIFF file', async () => {
    const file = createMockFile('test.tiff');

    (image.extractExifMetadata as vi.Mock).mockResolvedValue({
      author: 'EXIF Author',
      creator: 'EXIF Creator',
      __exifAll: { Model: 'Test Camera' },
    });
    (image.extractXmpXmlFromBuffer as vi.Mock).mockReturnValue(null);
    (nlp.shouldFlagPersonValue as vi.Mock).mockResolvedValue(true);

    const processedFile = await parseTiff(file);

    expect(processedFile.fileName).toBe('test.tiff');
    expect(processedFile.metadata.fileType).toBe('TIFF Image');
    expect(processedFile.metadata.author).toBe('EXIF Author');
    expect((processedFile as any).exif).toEqual({ Model: 'Test Camera' });
    expect(processedFile.potentialIssues).toEqual([
      { type: 'AUTHOR FOUND', value: 'EXIF Author' },
      { type: 'CREATOR FOUND', value: 'EXIF Creator' },
    ]);
    expect(processedFile.metadata.note).toBeDefined();
  });

  it('extracts embedded XMP metadata', async () => {
    const file = createMockFile('test.tiff');

    (image.extractExifMetadata as vi.Mock).mockResolvedValue({});
    (image.extractXmpXmlFromBuffer as vi.Mock).mockReturnValue('<x:xmpmeta>...</x:xmpmeta>');
    (image.extractXmpMetadataFromXml as vi.Mock).mockReturnValue({
      title: 'XMP Title',
      author: 'XMP Author',
    });
    (nlp.shouldFlagPersonValue as vi.Mock).mockResolvedValue(true);

    const processedFile = await parseTiff(file);

    expect(processedFile.metadata.title).toBe('XMP Title');
    expect(processedFile.metadata.author).toBe('XMP Author');
    expect(processedFile.potentialIssues).toEqual([
      { type: 'AUTHOR FOUND', value: 'XMP Author' },
    ]);
  });

  it('handles TIFFs with no metadata', async () => {
    const file = createMockFile('test.tiff');
    (image.extractExifMetadata as vi.Mock).mockResolvedValue({});
    (image.extractXmpXmlFromBuffer as vi.Mock).mockReturnValue(null);
    (nlp.shouldFlagPersonValue as vi.Mock).mockResolvedValue(false);

    const processedFile = await parseTiff(file);

    expect(processedFile.metadata.author).toBeUndefined();
    expect(processedFile.potentialIssues).toBeUndefined();
    expect(processedFile.metadata.note).toBeDefined();
  });

  it('gracefully handles parsing errors', async () => {
    const file = createMockFile('test.tiff');
    (image.extractExifMetadata as vi.Mock).mockRejectedValue(new Error('Test error'));

    const processedFile = await parseTiff(file);

    // Should not throw, but return a basic object
    expect(processedFile.fileName).toBe('test.tiff');
    expect(Object.keys(processedFile.metadata).length).toBe(1); // only fileType
  });
});
