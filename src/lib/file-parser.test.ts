import { describe, it, expect, vi } from 'vitest';
import { parseFile } from './file-parser';

// Mock the parsing libraries
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 2,
      getMetadata: vi.fn().mockResolvedValue({
        info: {
          Author: 'Test Author',
          Title: 'Test Title',
        },
      }),
      getPage: vi.fn().mockImplementation(() =>
        Promise.resolve({
          getTextContent: vi.fn().mockResolvedValue({
            items: [
              { str: 'Reach us at test@example.com' },
              { str: 'Visit https://example.com for details' },
            ],
          }),
        })
      ),
    }),
  }),
  GlobalWorkerOptions: {
    workerSrc: '',
  },
  version: 'mock-version',
}));

vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn().mockResolvedValue({ value: 'some text' }),
  },
}));

vi.mock('xlsx', () => ({
  read: vi.fn().mockReturnValue({
    SheetNames: ['Sheet1'],
    Sheets: {
      'Sheet1': {
        '!ref': 'A1:A1',
        A1: { t: 's', v: 'test' },
      },
    },
    Props: {
      Author: 'Test Author',
      Title: 'Test Title',
    },
  }),
}));

vi.mock('jszip', () => ({
  default: {
    loadAsync: vi.fn().mockResolvedValue({
      file: (path: string) => {
        if (path === 'docProps/core.xml') {
          return {
            async: () => Promise.resolve('<coreProperties><creator>Test Author</creator><lastModifiedBy>Test User</lastModifiedBy></coreProperties>'),
          };
        }
        if (path === 'docProps/app.xml') {
          return {
            async: () => Promise.resolve('<Properties></Properties>'),
          };
        }
        return null;
      },
      files: {
        'ppt/slides/slide1.xml': { async: () => Promise.resolve('<xml></xml>') },
      },
    }),
  },
}));

vi.mock('exifreader', () => ({
  load: vi.fn().mockResolvedValue({
    'Artist': { description: 'Test Artist' },
    'XPAuthor': { description: 'Test Author' },
  }),
}));

describe('file-parser', () => {
  it('should parse a PDF file', async () => {
    const file = new File([''], 'test.pdf', { type: 'application/pdf' }) as any;
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const result = await parseFile(file);
    expect(result.fileName).toBe('test.pdf');
    expect(result.potentialIssues?.[0].value).toBe('Test Author');
    expect(result.metadata.pages).toBe(2);
    expect(result.metadata.title).toBe('Test Title');
    // Newly added content scanning
    expect(Array.isArray((result.metadata as any).emailsFound)).toBe(true);
    expect((result.metadata as any).emailsFound[0]).toBe('test@example.com');
    expect(Array.isArray((result.metadata as any).urlsFound)).toBe(true);
    expect((result.metadata as any).urlsFound[0]).toBe('https://example.com');
  });

  it('should parse a DOCX file', async () => {
    const file = new File([''], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }) as any;
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const result = await parseFile(file);
    expect(result.fileName).toBe('test.docx');
    expect(result.potentialIssues?.[0].value).toBe('Test Author');
  });

  it('should parse an XLSX file', async () => {
    const file = new File([''], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) as any;
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const result = await parseFile(file);
    expect(result.fileName).toBe('test.xlsx');
    expect(result.potentialIssues?.[0].value).toBe('Test Author');
    expect(result.metadata.title).toBe('Test Title');
  });

  it('should handle an unsupported file type', async () => {
    const file = new File([''], 'test.txt', { type: 'text/plain' }) as any;
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const result = await parseFile(file);
    expect(result.fileName).toBe('test.txt');
    expect(result.metadata.error).toBe('Unsupported file type');
  });

  it('should parse a PPTX file', async () => {
    const file = new File([''], 'test.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }) as any;
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const result = await parseFile(file);
    expect(result.fileName).toBe('test.pptx');
    expect(result.potentialIssues?.[0].value).toBe('Test Author');
  });

  it('should parse a CSV file', async () => {
    const csvContent = `header1,header2\nvalue1,value2`;
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' }) as any;
    file.text = vi.fn().mockResolvedValue(csvContent);
    const result = await parseFile(file);
    expect(result.fileName).toBe('test.csv');
    expect((result.metadata as any).numberOfRows).toBe(1);
  });

  it('should parse a Markdown file', async () => {
    const mdContent = `# My document\n\nThis is a test.`;
    const file = new File([mdContent], 'test.md', { type: 'text/markdown' }) as any;
    file.text = vi.fn().mockResolvedValue(mdContent);
    const result = await parseFile(file);
    expect(result.fileName).toBe('test.md');
    expect((result.metadata as any).title).toBe('My document');
  });

  it('should parse a JSON file', async () => {
    const jsonContent = `{ "author": "JSON Author", "key": "value" }`;
    const file = new File([jsonContent], 'test.json', { type: 'application/json' }) as any;
    file.text = vi.fn().mockResolvedValue(jsonContent);
    const result = await parseFile(file);
    expect(result.fileName).toBe('test.json');
    expect(result.potentialIssues?.[0].value).toBe('JSON Author');
  });

  it('should parse a JPG file', async () => {
    const file = new File([''], 'test.jpg', { type: 'image/jpeg' }) as any;
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const result = await parseFile(file);
    expect(result.fileName).toBe('test.jpg');
    expect((result.metadata as any).author).toBe('Test Artist');
  });

  it('should parse a PNG file', async () => {
    const file = new File([''], 'test.png', { type: 'image/png' }) as any;
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const result = await parseFile(file);
    expect(result.fileName).toBe('test.png');
    expect((result.metadata as any).author).toBe('Test Artist');
  });

  it('should handle legacy .doc files', async () => {
    const file = new File([''], 'test.doc') as any;
    const result = await parseFile(file);
    expect(result.metadata.error).toContain('Legacy .doc format not supported');
  });
});
