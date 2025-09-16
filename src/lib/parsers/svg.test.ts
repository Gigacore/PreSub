import { describe, it, expect, vi } from 'vitest';
import { parseSvg } from './svg';
import * as nlp from '../analysis/nlp';
import * as image from '../utils/image';
import { JSDOM } from 'jsdom';
const dom = new JSDOM();
global.DOMParser = dom.window.DOMParser;

vi.mock('../analysis/nlp');
vi.mock('../utils/image');

const createMockFile = (content: string, name: string) => {
  return {
    name,
    text: () => Promise.resolve(content),
  } as File;
};

const createErrorFile = (name: string) => {
    return {
        name,
        text: () => Promise.reject(new Error('Read error')),
    } as File;
}

describe('svg parser', () => {
  it('parses a simple SVG file', async () => {
    const svgContent = `
      <svg xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
           xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
           sodipodi:docname="test.svg"
           inkscape:version="1.0">
        <title>Test Title</title>
        <desc>Test Description</desc>
      </svg>`;
    const file = createMockFile(svgContent, 'test.svg');

    const processedFile = await parseSvg(file);

    expect(processedFile.fileName).toBe('test.svg');
    expect(processedFile.metadata.fileType).toBe('SVG Image');
    expect(processedFile.metadata.title).toBe('Test Title');
    expect(processedFile.metadata.description).toBe('Test Description');
    expect(processedFile.metadata.docName).toBe('test.svg');
    expect(processedFile.metadata.creatorTool).toBe('1.0');
  });

  it('extracts embedded XMP metadata', async () => {
    const xmpContent = '<x:xmpmeta>...</x:xmpmeta>';
    const svgContent = `<svg><metadata>${xmpContent}</metadata></svg>`;
    const file = createMockFile(svgContent, 'test.svg');

    (image.extractXmpXmlFromString as vi.Mock).mockReturnValue(xmpContent);
    (image.extractXmpMetadataFromXml as vi.Mock).mockReturnValue({
      title: 'XMP Title',
      author: 'XMP Author',
      creator: 'XMP Creator',
    });
    (nlp.shouldFlagPersonValue as vi.Mock).mockResolvedValue(true);

    const processedFile = await parseSvg(file);

    expect(processedFile.metadata.title).toBe('XMP Title');
    expect(processedFile.metadata.author).toBe('XMP Author');
    expect(processedFile.potentialIssues).toEqual([
      { type: 'AUTHOR FOUND', value: 'XMP Author' },
      { type: 'CREATOR FOUND', value: 'XMP Creator' },
    ]);
  });

  it('falls back to creator element if no XMP is found', async () => {
    const svgContent = `<svg><creator>Fallback Creator</creator></svg>`;
    const file = createMockFile(svgContent, 'test.svg');
    (image.extractXmpXmlFromString as vi.Mock).mockReturnValue(null);
    (nlp.shouldFlagPersonValue as vi.Mock).mockResolvedValue(true);

    const processedFile = await parseSvg(file);

    expect(processedFile.metadata.author).toBe('Fallback Creator');
    expect(processedFile.potentialIssues).toEqual([
        { type: 'AUTHOR FOUND', value: 'Fallback Creator' },
    ]);
  });

  it('handles SVGs with no metadata', async () => {
    const svgContent = `<svg></svg>`;
    const file = createMockFile(svgContent, 'test.svg');
    (image.extractXmpXmlFromString as vi.Mock).mockReturnValue(null);
    (nlp.shouldFlagPersonValue as vi.Mock).mockResolvedValue(false);


    const processedFile = await parseSvg(file);

    expect(processedFile.metadata.title).toBeUndefined();
    expect(processedFile.metadata.description).toBeUndefined();
    expect(processedFile.potentialIssues).toBeUndefined();
  });

  it('gracefully handles parsing errors', async () => {
    const invalidSvgContent = `not valid xml`;
    const file = createMockFile(invalidSvgContent, 'test.svg');

    const processedFile = await parseSvg(file);

    // Should not throw, but return a basic object
    expect(processedFile.fileName).toBe('test.svg');
    expect(Object.keys(processedFile.metadata).length).toBe(1); // only fileType
  });

  it('gracefully handles read errors', async () => {
    const file = createErrorFile('test.svg');
    try {
        await parseSvg(file)
    } catch (e) {
        expect((e as Error).message).toBe('Read error');
    }
  });
});
