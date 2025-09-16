import { describe, it, expect, vi } from 'vitest';
import {
  extractXmpXmlFromBuffer,
  extractXmpXmlFromString,
  extractXmpMetadataFromXml,
  extractPngTextChunks,
  extractExifMetadata,
} from './image';
import * as ExifReader from 'exifreader';
import { JSDOM } from 'jsdom';
const dom = new JSDOM();
global.DOMParser = dom.window.DOMParser;


vi.mock('exifreader');

describe('image utils', () => {
  describe('XMP extraction', () => {
    const xmpString = '<x:xmpmeta>...data...</x:xmpmeta>';
    const fullString = `other data ${xmpString} more data`;

    it('extracts XMP XML from a string', () => {
      expect(extractXmpXmlFromString(fullString)).toBe(xmpString);
      expect(extractXmpXmlFromString('no xmp here')).toBeNull();
    });

    it('extracts XMP XML from a buffer', () => {
      const buffer = new TextEncoder().encode(fullString).buffer;
      expect(extractXmpXmlFromBuffer(buffer)).toBe(xmpString);
    });

    it('extracts metadata from XMP XML', () => {
      const xml = `
        <x:xmpmeta xmlns:x="adobe:ns:meta/">
          <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
            <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
              <dc:title>Test Title</dc:title>
              <dc:creator>
                <rdf:Seq>
                  <rdf:li>Creator 1</rdf:li>
                </rdf:Seq>
              </dc:creator>
            </rdf:Description>
          </rdf:RDF>
        </x:xmpmeta>`;
      const meta = extractXmpMetadataFromXml(xml);
      expect(meta.title).toBe('Test Title');
      expect(meta.creator).toBe('Creator 1');
      expect(meta.author).toBe('Creator 1');
    });
  });

  describe('PNG tEXt chunk extraction', () => {
    it('extracts text chunks from a mock PNG buffer', () => {
      // A mock PNG with a tEXt chunk
      const buffer = new Uint8Array([
        137, 80, 78, 71, 13, 10, 26, 10, // PNG signature
        0, 0, 0, 12, // chunk length
        116, 69, 88, 116, // "tEXt"
        ...new TextEncoder().encode('keyword\0text'),
        0, 0, 0, 0, // CRC
        0, 0, 0, 0, // IEND chunk length
        73, 69, 78, 68, // "IEND"
        0, 0, 0, 0 // CRC
      ]).buffer;
      const chunks = extractPngTextChunks(buffer);
      expect(chunks.keyword).toBe('text');
    });
  });

  describe('EXIF metadata extraction', () => {
    it('extracts and normalizes EXIF data', async () => {
      (ExifReader.load as vi.Mock).mockResolvedValue({
        Artist: { description: 'Test Artist' },
        DateTimeOriginal: { description: '2024:01:01 12:00:00' },
      });

      const meta = await extractExifMetadata(new ArrayBuffer(0));
      expect(meta.author).toBe('Test Artist');
      expect(meta.creationDate).toBe('2024-01-01T12:00:00.000Z');
      expect((meta as any).__exifAll).toBeDefined();
    });

    it('handles EXIF parsing errors gracefully', async () => {
      (ExifReader.load as vi.Mock).mockRejectedValue(new Error('Test error'));
      const meta = await extractExifMetadata(new ArrayBuffer(0));
      expect(meta).toEqual({});
    });
  });
});
