import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ResultItem from './ResultItem';
import type { ProcessedFile } from '../App';

const mockResult: ProcessedFile = {
  fileName: 'test.pdf',
  previewUrl: 'test.jpg',
  metadata: {
    author: 'Test Author',
    pages: 10,
  },
  potentialIssues: [
    { type: 'AUTHOR FOUND', value: 'Test Author' },
  ],
  contentFindings: {
    emails: [{ value: 'test@example.com', pages: [1] }],
    urls: [{ value: 'http://example.com', pages: [1] }],
  },
};

describe('ResultItem', () => {
  it('renders the file name in the header', () => {
    render(<ResultItem result={mockResult} />);
    expect(screen.getByText('test.pdf')).toBeInTheDocument();
  });

  it('shows potential issues when present', () => {
    render(<ResultItem result={mockResult} />);
    expect(screen.getByText(/Potential Issues/)).toBeInTheDocument();
    expect(screen.getByText(/AUTHOR FOUND/)).toBeInTheDocument();
  });

  it('filters issues when dismiss is clicked', () => {
    render(<ResultItem result={mockResult} />);
    const dismissButton = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismissButton);
    expect(screen.queryByText(/AUTHOR FOUND/)).not.toBeInTheDocument();
  });

  it('shows content findings info banner when content findings are present', () => {
    render(<ResultItem result={mockResult} />);
    expect(screen.getByText('Review Suggested')).toBeInTheDocument();
  });

  it('shows research signals info banner when research signals are detected', () => {
    const withSignals: ProcessedFile = {
      ...mockResult,
      metadata: {
        ...mockResult.metadata,
        acknowledgementsDetected: true,
      },
    };
    render(<ResultItem result={withSignals} />);
    expect(screen.getByText('Research Signals Detected')).toBeInTheDocument();
  });

  it('renders the metadata display', () => {
    render(<ResultItem result={mockResult} />);
    expect(screen.getByText('Metadata')).toBeInTheDocument();
    expect(screen.getByText('AUTHOR')).toBeInTheDocument();
    expect(screen.getByText('Test Author')).toBeInTheDocument();
  });

  it('calls onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn();
    render(<ResultItem result={mockResult} onRemove={onRemove} />);
    const removeButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeButton);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('opens the lightbox when the preview button is clicked', () => {
    render(<ResultItem result={mockResult} />);
    const previewButton = screen.getByLabelText('Preview test.pdf');
    fireEvent.click(previewButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('scrolls to section when info banner is clicked', () => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<ResultItem result={mockResult} />);
    const banner = screen.getByText('Review Suggested');
    fireEvent.click(banner);
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
