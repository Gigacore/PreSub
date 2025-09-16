import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FileDropzone from './FileDropzone';
import { useDropzone } from 'react-dropzone';

vi.mock('react-dropzone');

const useDropzoneMock = useDropzone as vi.Mock;

describe('FileDropzone', () => {
  it('renders the dropzone with instructions', () => {
    useDropzoneMock.mockReturnValue({
      getRootProps: () => ({}),
      getInputProps: () => ({}),
      isDragActive: false,
    });
    render(<FileDropzone onFilesSelected={() => {}} />);
    expect(screen.getByText(/drop files here/i)).toBeInTheDocument();
  });

  it('shows different text when a file is being dragged over', () => {
    useDropzoneMock.mockReturnValue({
      getRootProps: () => ({}),
      getInputProps: () => ({}),
      isDragActive: true,
    });
    render(<FileDropzone onFilesSelected={() => {}} />);
    expect(screen.getByText(/drop the files here/i)).toBeInTheDocument();
  });

  it('calls onFilesSelected with accepted files', () => {
    const onFilesSelected = vi.fn();
    const mockFiles = [new File([''], 'test.pdf', { type: 'application/pdf' })];
    let onDrop: (files: File[]) => void;

    useDropzoneMock.mockImplementation((options) => {
      onDrop = options.onDrop;
      return {
        getRootProps: () => ({}),
        getInputProps: () => ({}),
        isDragActive: false,
      };
    });

    render(<FileDropzone onFilesSelected={onFilesSelected} />);
    onDrop(mockFiles);
    expect(onFilesSelected).toHaveBeenCalledWith(mockFiles);
  });

  it('shows an error message for rejected files', async () => {
    let onDropRejected: (rejections: any[]) => void;
    useDropzoneMock.mockImplementation((options) => {
      onDropRejected = options.onDropRejected;
      return {
        getRootProps: () => ({}),
        getInputProps: () => ({}),
        isDragActive: false,
      };
    });
    render(<FileDropzone onFilesSelected={() => {}} />);
    act(() => {
      onDropRejected([{ file: new File([''], 'test.txt'), errors: [] }]);
    });
    await waitFor(() => {
      expect(screen.getByText(/some files were rejected/i)).toBeInTheDocument();
    });
  });
});
