import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Lightbox } from './Lightbox';

describe('Lightbox', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
  });

  it('renders the image with the correct src and alt text', () => {
    const { getByAltText } = render(
      <Lightbox previewUrl="test.jpg" fileName="test.jpg" onClose={onClose} />
    );
    const img = getByAltText('test.jpg') as HTMLImageElement;
    expect(img.src).toContain('test.jpg');
  });

  it('calls onClose when the close button is clicked', () => {
    const { getByLabelText } = render(
      <Lightbox previewUrl="test.jpg" fileName="test.jpg" onClose={onClose} />
    );
    fireEvent.click(getByLabelText('Close preview'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the background is clicked', () => {
    const { getByRole } = render(
      <Lightbox previewUrl="test.jpg" fileName="test.jpg" onClose={onClose} />
    );
    fireEvent.click(getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the Escape key is pressed', () => {
    render(<Lightbox previewUrl="test.jpg" fileName="test.jpg" onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when the image is clicked', () => {
    const { getByAltText } = render(
      <Lightbox previewUrl="test.jpg" fileName="test.jpg" onClose={onClose} />
    );
    fireEvent.click(getByAltText('test.jpg'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
