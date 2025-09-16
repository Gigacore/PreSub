import { describe, it, expect } from 'vitest';
import { containsLatex } from './misc';

describe('misc utils', () => {
  it('returns true for strings containing "LaTeX" (case-insensitive)', () => {
    expect(containsLatex('This was generated with LaTeX.')).toBe(true);
    expect(containsLatex('latex is great')).toBe(true);
    expect(containsLatex('MiKTeX')).toBe(false);
  });

  it('returns false for strings without "LaTeX"', () => {
    expect(containsLatex('This is a regular string.')).toBe(false);
  });

  it('returns false for non-string inputs', () => {
    expect(containsLatex(123)).toBe(false);
    expect(containsLatex(null)).toBe(false);
    expect(containsLatex(undefined)).toBe(false);
    expect(containsLatex({})).toBe(false);
  });
});
