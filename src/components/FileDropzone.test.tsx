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
    act(() => {
        onDrop(mockFiles);
    });
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
      onDropRejected([{ file: {name: 'test.txt'}, errors: [] }]);
    });
    await waitFor(() => {
      expect(screen.getByText(/some files were rejected/i)).toBeInTheDocument();
    });
  });

  it('shows a specific error message for legacy office formats', async () => {
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
      onDropRejected([{ file: {name: 'test.doc'}, errors: [] }]);
    });
    await waitFor(() => {
      expect(screen.getByText(/legacy formats/i)).toBeInTheDocument();
    });
  });

  it('validates file types correctly', () => {
    let validator: (file: File) => any;
    useDropzoneMock.mockImplementation((options) => {
      validator = options.validator;
      return {
        getRootProps: () => ({}),
        getInputProps: () => ({}),
        isDragActive: false,
      };
    });
    render(<FileDropzone onFilesSelected={() => {}} />);

    const validFile = new File([''], 'test.pdf', { type: 'application/pdf' });
    const invalidFile = new File([''], 'test.txt', { type: 'text/plain' });

    expect(validator(validFile)).toBeNull();
    expect(validator(invalidFile)).toEqual({
      code: 'file-invalid-type',
      message: 'Unsupported file type. Please select a supported format.',
    });
  });
});
