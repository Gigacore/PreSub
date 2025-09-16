import { describe, it, expect } from 'vitest';
import { toISO } from './date';

describe('date utils', () => {
  it('converts EXIF date format to ISO 8601', () => {
    const exifDate = '2024:01:01 12:00:00';
    const isoDate = '2024-01-01T12:00:00.000Z';
    expect(toISO(exifDate)).toBe(isoDate);
  });

  it('handles regular date strings', () => {
    const regularDate = '2024-01-01T12:00:00.000Z';
    expect(toISO(regularDate)).toBe(regularDate);
  });

  it('returns undefined for invalid date strings', () => {
    const invalidDate = 'not a date';
    expect(toISO(invalidDate)).toBeUndefined();
  });

  it('returns undefined for empty or undefined input', () => {
    expect(toISO('')).toBeUndefined();
    expect(toISO(undefined)).toBeUndefined();
  });

  it('handles date strings with leading/trailing spaces', () => {
    const exifDate = ' 2024:01:01 12:00:00 ';
    const isoDate = '2024-01-01T12:00:00.000Z';
    expect(toISO(exifDate)).toBe(isoDate);
  });
});
