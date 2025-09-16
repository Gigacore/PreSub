import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ExifDisplay } from './ExifDisplay';

describe('ExifDisplay', () => {
  const exifData = {
    Make: 'Canon',
    Model: 'Canon EOS 5D Mark IV',
  };

  it('renders nothing if no exif data is provided', () => {
    const { container } = render(<ExifDisplay exif={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a button with the tag count', () => {
    const { getByText } = render(<ExifDisplay exif={exifData} />);
    expect(getByText('EXIF Data')).toBeInTheDocument();
    expect(getByText('(2 tags)')).toBeInTheDocument();
  });

  it('toggles the exif table when the button is clicked', () => {
    const { getByText, queryByRole } = render(<ExifDisplay exif={exifData} />);
    const button = getByText('EXIF Data');

    expect(queryByRole('table')).toBeNull();

    fireEvent.click(button);

    expect(queryByRole('table')).toBeInTheDocument();

    fireEvent.click(button);

    expect(queryByRole('table')).toBeNull();
  });

  it('displays the exif data in a table when open', () => {
    const { getByText } = render(<ExifDisplay exif={exifData} />);
    const button = getByText('EXIF Data');

    fireEvent.click(button);

    expect(getByText('Make')).toBeInTheDocument();
    expect(getByText('Canon')).toBeInTheDocument();
    expect(getByText('Model')).toBeInTheDocument();
    expect(getByText('Canon EOS 5D Mark IV')).toBeInTheDocument();
  });
});
