import { describe, it, expect, vi } from 'vitest';
import { safeReadText } from './zip';
import JSZip from 'jszip';

vi.mock('jszip');

describe('zip utils', () => {
  it('safely reads a text file from a zip', async () => {
    const mockZip = {
      file: (path: string) => {
        if (path === 'test.txt') {
          return {
            async: () => Promise.resolve('hello world'),
          };
        }
        return null;
      },
    };

    const content = await safeReadText(mockZip as unknown as JSZip, 'test.txt');
    expect(content).toBe('hello world');
  });

  it('returns null if the file does not exist', async () => {
    const mockZip = {
      file: () => null,
    };
    const content = await safeReadText(mockZip as unknown as JSZip, 'nonexistent.txt');
    expect(content).toBeNull();
  });

  it('returns null if reading the file throws an error', async () => {
    const mockZip = {
      file: (path: string) => ({
        async: () => Promise.reject(new Error('Read error')),
      }),
    };
    const content = await safeReadText(mockZip as unknown as JSZip, 'error.txt');
    expect(content).toBeNull();
  });
});
