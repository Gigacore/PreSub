import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ContentFindings } from './ContentFindings';
import type { ProcessedFile } from '../../App';

const mockResult: ProcessedFile = {
  fileName: 'test.pdf',
  metadata: { fileType: 'PDF' },
  contentFindings: {
    emails: [
        { value: 'test@example.com', pages: [1] },
        { value: 'user@another-domain.com', pages: [2] },
    ],
    urls: [
        { value: 'http://example.com', pages: [1] },
        { value: 'https://another-domain.com/path', pages: [2] },
    ],
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
        urlsFound: ['legacy.com'],
      },
    };
    render(<ContentFindings result={legacyResult} />);
    expect(screen.getByText('Content Findings')).toBeInTheDocument();
    expect(screen.getByText('legacy@example.com')).toBeInTheDocument();
    expect(screen.getByText('legacy.com')).toBeInTheDocument();
  });

  it('filters by domain', () => {
    render(<ContentFindings result={mockResult} />);
    const filter = screen.getByLabelText('Filter by domain');

    fireEvent.change(filter, { target: { value: 'example.com' } });

    expect(screen.queryByText('user@another-domain.com')).not.toBeInTheDocument();
    expect(screen.queryByText('https://another-domain.com/path')).not.toBeInTheDocument();
    expect(screen.getAllByText('test@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('http://example.com').length).toBeGreaterThan(0);
  });

  it('marks findings as reviewed', () => {
    render(<ContentFindings result={mockResult} />);
    const checkboxes = screen.getAllByRole('checkbox');
    const firstCheckbox = checkboxes[0];

    fireEvent.click(firstCheckbox);
    expect(firstCheckbox).toBeChecked();

    fireEvent.click(firstCheckbox);
    expect(firstCheckbox).not.toBeChecked();
  });

  it('shows the correct position label', () => {
    const docResult: ProcessedFile = { ...mockResult, fileName: 'test.docx', metadata: { fileType: 'Microsoft Word Document' } };
    const { rerender } = render(<ContentFindings result={docResult} />);
    expect(screen.getAllByText(/Page\(s\)/).length).toBeGreaterThan(0);

    const pptResult: ProcessedFile = { ...mockResult, fileName: 'test.pptx', metadata: { fileType: 'PowerPoint Presentation' } };
    rerender(<ContentFindings result={pptResult} />);
    expect(screen.getAllByText(/Slide\(s\)/).length).toBeGreaterThan(0);

    const jsonResult: ProcessedFile = { ...mockResult, fileName: 'test.json', metadata: { fileType: 'JSON' } };
    rerender(<ContentFindings result={jsonResult} />);
    expect(screen.getAllByText(/Line/).length).toBeGreaterThan(0);
  });
});
