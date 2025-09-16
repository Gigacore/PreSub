import { describe, it, expect } from 'vitest';
import { scanTextForEmailsAndUrls } from './content-scanner';

describe('scanTextForEmailsAndUrls', () => {
  it('should find a simple email address', () => {
    const matches: { value: string; kind: 'email' | 'url' }[] = [];
    const onMatch = (value: string, kind: 'email' | 'url') => {
      matches.push({ value, kind });
    };
    scanTextForEmailsAndUrls('My email is test@example.com.', onMatch);
    expect(matches).toEqual([{ value: 'test@example.com', kind: 'email' }]);
  });

  it('should find a simple URL', () => {
    const matches: { value: string; kind: 'email' | 'url' }[] = [];
    const onMatch = (value: string, kind: 'email' | 'url') => {
      matches.push({ value, kind });
    };
    scanTextForEmailsAndUrls('Visit our site at http://example.com.', onMatch);
    expect(matches).toEqual([{ value: 'http://example.com', kind: 'url' }]);
  });

  it('should find multiple, mixed items', () => {
    const matches: { value: string; kind: 'email' | 'url' }[] = [];
    const onMatch = (value: string, kind: 'email' | 'url') => {
      matches.push({ value, kind });
    };
    const text = 'Contact support@company.org or visit www.company.org/support for help.';
    scanTextForEmailsAndUrls(text, onMatch);
    expect(matches).toHaveLength(2);
    expect(matches).toContainEqual({ value: 'support@company.org', kind: 'email' });
    expect(matches).toContainEqual({ value: 'www.company.org/support', kind: 'url' });
  });

  it('should not detect an email address in a URL', () => {
    const matches: { value: string; kind: 'email' | 'url' }[] = [];
    const onMatch = (value: string, kind: 'email' | 'url') => {
      matches.push({ value, kind });
    };
    scanTextForEmailsAndUrls('Go to https://user@example.com/login', onMatch);
    expect(matches).toEqual([{ value: 'https://user@example.com/login', kind: 'url' }]);
  });

  it('should handle text with no emails or URLs', () => {
    const matches: { value: string; kind: 'email' | 'url' }[] = [];
    const onMatch = (value: string, kind: 'email' | 'url') => {
      matches.push({ value, kind });
    };
    scanTextForEmailsAndUrls('This is a plain sentence.', onMatch);
    expect(matches).toHaveLength(0);
  });

  it('should strip trailing punctuation from URLs', () => {
    const matches: { value: string; kind: 'email' | 'url' }[] = [];
    const onMatch = (value: string, kind: 'email' | 'url') => {
      matches.push({ value, kind });
    };
    scanTextForEmailsAndUrls('Check www.example.com/page).', onMatch);
    expect(matches).toEqual([{ value: 'www.example.com/page', kind: 'url' }]);
  });

  it('should find bare domains with paths', () => {
    const matches: { value: string; kind: 'email' | 'url' }[] = [];
    const onMatch = (value: string, kind: 'email' | 'url') => {
      matches.push({ value, kind });
    };
    scanTextForEmailsAndUrls('Link: example.com/path', onMatch);
    expect(matches).toEqual([{ value: 'example.com/path', kind: 'url' }]);
  });
});
