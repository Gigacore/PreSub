import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ResultItem from './ResultItem';
import type { ProcessedFile } from '../App';

const mockResult: ProcessedFile = {
  fileName: 'test.pdf',
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
  it('renders the file name', () => {
    render(<ResultItem result={mockResult} />);
    expect(screen.getByText('test.pdf')).toBeInTheDocument();
  });

  it('shows potential issues', () => {
    render(<ResultItem result={mockResult} />);
    expect(screen.getByText('POTENTIAL ISSUE')).toBeInTheDocument();
    expect(screen.getByText(/AUTHOR FOUND/)).toBeInTheDocument();
  });

  it('shows review suggested banner', () => {
    render(<ResultItem result={mockResult} />);
    expect(screen.getByText('Review Suggested')).toBeInTheDocument();
  });

  it('renders metadata', () => {
    render(<ResultItem result={mockResult} />);
    expect(screen.getByText('AUTHOR')).toBeInTheDocument();
    expect(screen.getByText('Test Author')).toBeInTheDocument();
    expect(screen.getByText('PAGES')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('calls onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn();
    render(<ResultItem result={mockResult} onRemove={onRemove} />);
    const removeButton = screen.getByRole('button', { name: /remove/i });
    fireEvent.click(removeButton);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
