import { describe, it, expect } from 'vitest';
import { number, variance } from './number';

describe('number utils', () => {
  describe('number', () => {
    it('converts a valid string to a number', () => {
      expect(number('123')).toBe(123);
      expect(number('123.45')).toBe(123.45);
    });

    it('returns undefined for invalid or empty strings', () => {
      expect(number('abc')).toBeUndefined();
      expect(number('')).toBeUndefined();
      expect(number(undefined)).toBeUndefined();
    });
  });

  describe('variance', () => {
    it('calculates the variance of a list of numbers', () => {
      expect(variance([1, 2, 3, 4, 5])).toBe(2);
      expect(variance([10, 10, 10, 10, 10])).toBe(0);
    });

    it('returns 0 for an empty list', () => {
      expect(variance([])).toBe(0);
    });
  });
});
