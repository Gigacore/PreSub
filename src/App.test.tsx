import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';
import * as fileParser from './lib/file-parser';

// Mock pdfjs-dist to prevent 'DOMMatrix is not defined' error
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {
    workerSrc: '',
  },
  getDocument: vi.fn(),
  version: 'mock',
}));

// Mock the file parser
vi.mock('./lib/file-parser');

// Mock the FileDropzone component
vi.mock('./components/FileDropzone', () => ({
  default: ({ onFilesSelected }: { onFilesSelected: (files: File[]) => void }) => (
    <div data-testid="mock-dropzone">
      <button onClick={() => onFilesSelected([new File([''], 'test.pdf')])}>
        Select Files
      </button>
    </div>
  ),
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('App', () => {
  it('handles file selection, processing, and clearing results', async () => {
    const parseFileMock = fileParser.parseFile as vi.Mock;
    parseFileMock.mockResolvedValue({
      fileName: 'test.pdf',
      metadata: { author: 'Test Author' },
    });

    render(<App />);

    // Initial state
    expect(screen.getByTestId('mock-dropzone')).toBeInTheDocument();
    expect(screen.queryByText(/test.pdf/)).not.toBeInTheDocument();

    // Select files
    const selectFilesButton = screen.getByText('Select Files');
    fireEvent.click(selectFilesButton);

    // Wait for results to appear
    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });

    // Clear results
    const clearButton = screen.getByRole('button', { name: /clear results/i });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
    });
  });
});
