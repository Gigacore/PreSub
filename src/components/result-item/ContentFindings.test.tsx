import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ContentFindings } from './ContentFindings';
import type { ProcessedFile } from '../../App';

const mockResult: ProcessedFile = {
  fileName: 'test.pdf',
  metadata: {},
  contentFindings: {
    emails: [{ value: 'test@example.com', pages: [1] }],
    urls: [{ value: 'http://example.com', pages: [1] }],
  },
};

describe('ContentFindings', () => {
  it('renders content findings when present', () => {
    render(<ContentFindings result={mockResult} />);
    expect(screen.getByText('Content Findings')).toBeInTheDocument();
    expect(screen.getAllByText('test@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('http://example.com').length).toBeGreaterThan(0);
  });

  it('renders nothing when no findings are present', () => {
    const emptyResult: ProcessedFile = {
      fileName: 'test.pdf',
      metadata: {},
    };
    const { container } = render(<ContentFindings result={emptyResult} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders legacy findings if new format is not present', () => {
    const legacyResult: ProcessedFile = {
      fileName: 'test.pdf',
      metadata: {
        emailsFound: ['legacy@example.com'],
      },
    };
    render(<ContentFindings result={legacyResult} />);
    expect(screen.getByText('Content Findings')).toBeInTheDocument();
    expect(screen.getByText('legacy@example.com')).toBeInTheDocument();
  });
});
