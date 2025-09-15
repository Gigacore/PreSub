import { describe, it, expect } from 'vitest';
import { scanResearchSignals } from './research-signals';

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
});
