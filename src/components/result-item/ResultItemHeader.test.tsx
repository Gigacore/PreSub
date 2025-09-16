import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResultItemHeader } from './ResultItemHeader';

describe('ResultItemHeader', () => {
  const onRemove = vi.fn();
  const onPreview = vi.fn();

  beforeEach(() => {
    onRemove.mockClear();
    onPreview.mockClear();
  });

  const baseResult = {
    fileName: 'test.txt',
    metadata: { fileType: 'text/plain' },
  };

  it('renders the file name', () => {
    const { getByText } = render(
      <ResultItemHeader result={baseResult as any} isImage={false} onPreview={onPreview} />
    );
    expect(getByText('test.txt')).toBeInTheDocument();
  });

  it('calls onRemove when the remove button is clicked', () => {
    const { getByLabelText } = render(
      <ResultItemHeader result={baseResult as any} isImage={false} onPreview={onPreview} onRemove={onRemove} />
    );
    fireEvent.click(getByLabelText('Remove test.txt'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('calls onPreview when the preview button is clicked for an image', () => {
    const result = { ...baseResult, previewUrl: 'test.jpg' };
    const { getByLabelText } = render(
      <ResultItemHeader result={result as any} isImage={true} onPreview={onPreview} />
    );
    fireEvent.click(getByLabelText('Preview test.txt'));
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it('calls onPreview when the preview button is clicked for a non-image', () => {
    const result = { ...baseResult, previewUrl: 'test.jpg' };
    const { getByLabelText } = render(
      <ResultItemHeader result={result as any} isImage={false} onPreview={onPreview} />
    );
    fireEvent.click(getByLabelText('Preview test.txt'));
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it('shows the correct icon for different file types', () => {
    const { rerender, getByText } = render(
        <ResultItemHeader result={baseResult as any} isImage={false} onPreview={onPreview} />
    );
    expect(getByText('description')).toBeInTheDocument();

    rerender(<ResultItemHeader result={{ fileName: 'test.jpg', metadata: {} } as any} isImage={true} onPreview={onPreview} />);
    expect(getByText('image')).toBeInTheDocument();

    rerender(<ResultItemHeader result={{ fileName: 'test.pptx', metadata: {} } as any} isImage={false} onPreview={onPreview} />);
    expect(getByText('slideshow')).toBeInTheDocument();

    rerender(<ResultItemHeader result={{ fileName: 'test.xlsx', metadata: {} } as any} isImage={false} onPreview={onPreview} />);
    expect(getByText('table')).toBeInTheDocument();

    rerender(<ResultItemHeader result={{ fileName: 'test.json', metadata: {} } as any} isImage={false} onPreview={onPreview} />);
    expect(getByText('code')).toBeInTheDocument();

    rerender(<ResultItemHeader result={{ fileName: 'test.csv', metadata: {} } as any} isImage={false} onPreview={onPreview} />);
    expect(getByText('text_snippet')).toBeInTheDocument();
  });
});
