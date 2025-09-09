import { describe, it, expect } from 'vitest';
import { analyzeFile, sanitizeFile } from '../src/index';
import fs from 'fs/promises';
import path from 'path';

describe('DOCX analysis and sanitization', () => {
  it('should analyze a .docx file and extract metadata', async () => {
    const filePath = path.resolve(__dirname, '../../../tests/fixtures/sample.docx');
    const buffer = await fs.readFile(filePath);

    const result = await analyzeFile(buffer);

    expect(result.critical).toContainEqual({
      id: 'author',
      description: 'The author of the document.',
      value: 'Test User',
    });

    expect(result.warning).toContainEqual({
      id: 'lastModifiedBy',
      description: 'The person who last modified the document.',
      value: 'Test User',
    });
  });

  it('should sanitize a .docx file and remove metadata', async () => {
    const filePath = path.resolve(__dirname, '../../../tests/fixtures/sample.docx');
    const buffer = await fs.readFile(filePath);

    const sanitizedBuffer = await sanitizeFile(buffer);

    const result = await analyzeFile(sanitizedBuffer);

    expect(result.critical.find(item => item.id === 'author')).toBeUndefined();
    expect(result.warning.find(item => item.id === 'lastModifiedBy')).toBeUndefined();
  });
});
