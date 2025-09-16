import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Results from './Results';
import type { ProcessedFile } from '../App';

const mockResults: ProcessedFile[] = [
  {
    fileName: 'test1.pdf',
    metadata: { author: 'Author 1' },
  },
  {
    fileName: 'test2.docx',
    metadata: { author: 'Author 2' },
  },
];

describe('Results', () => {
  it('renders a ResultItem for each result', () => {
    render(<Results results={mockResults} onClear={() => {}} onRemove={() => {}} />);
    expect(screen.getByText('test1.pdf')).toBeInTheDocument();
    expect(screen.getByText('test2.docx')).toBeInTheDocument();
  });

  it('calls onClear when the clear button is clicked', () => {
    const onClear = vi.fn();
    render(<Results results={mockResults} onClear={onClear} onRemove={() => {}} />);
    const clearButton = screen.getByRole('button', { name: /clear results/i });
    fireEvent.click(clearButton);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove with the correct index when a result is removed', () => {
    const onRemove = vi.fn();
    render(<Results results={mockResults} onClear={() => {}} onRemove={onRemove} />);
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]);
    expect(onRemove).toHaveBeenCalledWith(0);
    fireEvent.click(removeButtons[1]);
    expect(onRemove).toHaveBeenCalledWith(1);
  });
});
