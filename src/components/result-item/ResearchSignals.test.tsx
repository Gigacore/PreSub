import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ResearchSignals } from './ResearchSignals';
import type { ProcessedFile } from '../../App';

const mockResult: ProcessedFile = {
  fileName: 'test.pdf',
  metadata: {
    acknowledgementsDetected: true,
    fundingDetected: true,
    affiliationsDetected: true,
    fundingMentions: ['This work was supported by a grant.'],
    grantIds: ['12345'],
    affiliationsGuesses: ['University of Example'],
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

  it('handles dismiss and flag for acknowledgements', () => {
    render(<ResearchSignals result={mockResult} />);
    const dismissButton = screen.getAllByRole('button', { name: 'Dismiss' })[0];
    fireEvent.click(dismissButton);
    expect(screen.getByRole('button', { name: 'Flag' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Flag' }));
    expect(screen.getAllByRole('button', { name: 'Dismiss' })[0]).toBeInTheDocument();
  });

  it('handles dismiss and flag for affiliations', () => {
    render(<ResearchSignals result={mockResult} />);
    const dismissButton = screen.getAllByRole('button', { name: 'Dismiss' })[1];
    fireEvent.click(dismissButton);
    expect(screen.getByRole('button', { name: 'Flag' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Flag' }));
    expect(screen.getAllByRole('button', { name: 'Dismiss' })[1].textContent).toBe('Dismiss');
  });

  it('renders funding mentions and grant IDs', () => {
    render(<ResearchSignals result={mockResult} />);
    expect(screen.getByText('This work was supported by a grant.')).toBeInTheDocument();
    expect(screen.getByText('12345')).toBeInTheDocument();
  });

  it('renders fallback text when researchFindings is not present', () => {
    const noFindingsResult: ProcessedFile = {
        ...mockResult,
        researchFindings: undefined,
    };
    render(<ResearchSignals result={noFindingsResult} />);
    expect(screen.getByText('Acknowledgements section or phrasing detected.')).toBeInTheDocument();
    expect(screen.getByText('Affiliation cues detected near author block.')).toBeInTheDocument();
  });
});
