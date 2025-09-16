import { describe, it, expect } from 'vitest';
import { scanResearchSignals, addFinding } from './research-signals';

describe('scanResearchSignals', () => {
  it('should detect an acknowledgements section', () => {
    const text = 'This is the intro. Acknowledgements. We thank our families.';
    const signals = scanResearchSignals(text);
    expect(signals.acknowledgementsDetected).toBe(true);
    expect(signals.acknowledgementsExcerpt).toContain('Acknowledgements');
  });

  it('should detect a funding phrase', () => {
    const text = 'This work was supported by the National Science Foundation.';
    const signals = scanResearchSignals(text);
    expect(signals.fundingDetected).toBe(true);
    expect(signals.fundingMentions?.[0]).toContain('supported by');
  });

  it('should detect a grant ID', () => {
    const text = 'This research was funded by grant number NSF12345.';
    const signals = scanResearchSignals(text);
    expect(signals.fundingDetected).toBe(true);
    expect(signals.grantIds).toEqual(['NSF12345']);
  });

  it('should detect an affiliation cue', () => {
    const text = 'The author is from the Department of Computer Science, University of Example.';
    const signals = scanResearchSignals(text);
    expect(signals.affiliationsDetected).toBe(true);
    expect(signals.affiliationsGuesses?.[0]).toContain('University of Example');
  });

  it('should not detect signals in plain text', () => {
    const text = 'This is a regular sentence about a cat.';
    const signals = scanResearchSignals(text);
    expect(signals.acknowledgementsDetected).toBe(false);
    expect(signals.fundingDetected).toBe(false);
    expect(signals.affiliationsDetected).toBe(false);
  });

  it('should handle empty text', () => {
    const signals = scanResearchSignals('');
    expect(signals.acknowledgementsDetected).toBe(false);
    expect(signals.fundingDetected).toBe(false);
    expect(signals.affiliationsDetected).toBe(false);
  });
});

describe('addFinding', () => {
    it('should add a new finding to the map', () => {
        const map = new Map();
        addFinding(map, 'Test finding', 1);
        expect(map.has('Test finding')).toBe(true);
        expect(Array.from(map.get('Test finding')!)).toEqual([1]);
    });

    it('should add a page number to an existing finding', () => {
        const map = new Map();
        addFinding(map, 'Test finding', 1);
        addFinding(map, 'Test finding', 2);
        expect(Array.from(map.get('Test finding')!)).toEqual([1, 2]);
    });

    it('should normalize the key', () => {
        const map = new Map();
        addFinding(map, '  Test  finding  ', 1);
        expect(map.has('Test finding')).toBe(true);
    });

    it('should not add empty keys', () => {
        const map = new Map();
        addFinding(map, '   ', 1);
        expect(map.size).toBe(0);
    });
});
