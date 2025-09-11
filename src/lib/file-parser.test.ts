import { describe, it, expect, vi } from 'vitest';
import { parseFile } from './file-parser';

// Mock the parsing libraries
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 10,
      getMetadata: vi.fn().mockResolvedValue({
        info: {
          Author: 'Test Author',
          Title: 'Test Title',
        },
      }),
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
    Props: {
      Author: 'Test Author',
      Title: 'Test Title',
    },
  }),
}));

describe('file-parser', () => {
  it('should parse a PDF file', async () => {
    const file = new File([''], 'test.pdf', { type: 'application/pdf' }) as any;
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const result = await parseFile(file);
    expect(result.fileName).toBe('test.pdf');
    expect(result.potentialIssue?.value).toBe('Test Author');
    expect(result.metadata.pages).toBe(10);
    expect(result.metadata.title).toBe('Test Title');
  });

  it('should parse a DOCX file', async () => {
    const file = new File([''], 'test.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }) as any;
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const result = await parseFile(file);
    expect(result.fileName).toBe('test.docx');
    expect(result.metadata.wordCount).toBe(2);
  });

  it('should parse an XLSX file', async () => {
    const file = new File([''], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) as any;
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const result = await parseFile(file);
    expect(result.fileName).toBe('test.xlsx');
    expect(result.potentialIssue?.value).toBe('Test Author');
    expect(result.metadata.title).toBe('Test Title');
  });

  it('should handle an unsupported file type', async () => {
    const file = new File([''], 'test.txt', { type: 'text/plain' }) as any;
    file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const result = await parseFile(file);
    expect(result.fileName).toBe('test.txt');
    expect(result.metadata.error).toBe('Unsupported file type');
  });
});
