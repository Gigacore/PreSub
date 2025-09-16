import { describe, it, expect } from 'vitest';
import { escapeRegExp, parseDelimitedLine, extractFrontMatter } from './text';

describe('text utils', () => {
  describe('escapeRegExp', () => {
    it('escapes special regex characters', () => {
      const str = '.*+?^${}()|[]\\';
      const escaped = '\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\';
      expect(escapeRegExp(str)).toBe(escaped);
    });
  });

  describe('parseDelimitedLine', () => {
    it('parses a simple comma-delimited line', () => {
      const line = 'a,b,c';
      expect(parseDelimitedLine(line, ',')).toEqual(['a', 'b', 'c']);
    });

    it('handles quoted fields', () => {
      const line = '"a,b",c';
      expect(parseDelimitedLine(line, ',')).toEqual(['a,b', 'c']);
    });

    it('handles escaped quotes', () => {
      const line = '"a""b",c';
      expect(parseDelimitedLine(line, ',')).toEqual(['a"b', 'c']);
    });
  });

  describe('extractFrontMatter', () => {
    it('extracts YAML front matter from markdown', () => {
      const text = `---
title: Test
tags: [a, b]
---
# Body`;
      const result = extractFrontMatter(text);
      expect(result?.data.title).toBe('Test');
      expect(result?.data.tags).toEqual(['a', 'b']);
      expect(result?.body).toBe('# Body');
    });

    it('handles various data types in front matter', () => {
        const text = `---
string: hello
number: 123
boolean: true
date: 2024-01-01
array: [1, "two"]
---
Content`;
        const result = extractFrontMatter(text);
        expect(result?.data.string).toBe('hello');
        expect(result?.data.number).toBe(123);
        expect(result?.data.boolean).toBe(true);
        expect(result?.data.date).toBe('2024-01-01');
        expect(result?.data.array).toEqual(['1', 'two']);
    });

    it('returns null if no front matter is present', () => {
      const text = '# No front matter';
      expect(extractFrontMatter(text)).toBeNull();
    });
  });
});
