import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ResearchSignals } from './ResearchSignals';
import type { ProcessedFile } from '../../App';

const mockResult: ProcessedFile = {
  fileName: 'test.pdf',
  metadata: {
    acknowledgementsDetected: true,
    fundingDetected: true,
    affiliationsDetected: true,
  },
  researchFindings: {
    acknowledgements: [{ text: 'We thank our funders.', pages: [1] }],
    affiliations: [{ text: 'University of Example', pages: [1] }],
  },
};

describe('ResearchSignals', () => {
  it('renders research signals when present', () => {
    render(<ResearchSignals result={mockResult} />);
    expect(screen.getByText('Research Signals')).toBeInTheDocument();
    expect(screen.getByText('Acknowledgements')).toBeInTheDocument();
    expect(screen.getByText('Funding')).toBeInTheDocument();
    expect(screen.getByText('Affiliations')).toBeInTheDocument();
  });

  it('renders nothing when no signals are present', () => {
    const emptyResult: ProcessedFile = {
      fileName: 'test.pdf',
      metadata: {},
    };
    const { container } = render(<ResearchSignals result={emptyResult} />);
    expect(container).toBeEmptyDOMElement();
  });
});
