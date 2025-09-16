import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
    beforeEach(() => {
        vi.clearAllMocks();
    });

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
    await act(async () => {
        fireEvent.click(selectFilesButton);
    });

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

  it('handles removing a single result', async () => {
    const parseFileMock = fileParser.parseFile as vi.Mock;
    parseFileMock.mockResolvedValue({
        fileName: 'test.pdf',
        metadata: { author: 'Test Author' },
    });

    render(<App />);
    const selectFilesButton = screen.getByText('Select Files');
    await act(async () => {
        fireEvent.click(selectFilesButton);
    });

    await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });

    const removeButton = screen.getAllByRole('button', { name: /remove/i })[0];
    fireEvent.click(removeButton);

    await waitFor(() => {
        expect(screen.queryByText('test.pdf')).not.toBeInTheDocument();
    });
  });

  it('shows and hides the back to top button on scroll', async () => {
    render(<App />);

    act(() => {
        window.scrollY = 500;
        window.dispatchEvent(new Event('scroll'));
    });

    await waitFor(() => {
        expect(screen.getByLabelText('Back to top')).toBeInTheDocument();
    });

    act(() => {
        window.scrollY = 100;
        window.dispatchEvent(new Event('scroll'));
    });

    await waitFor(() => {
        expect(screen.queryByLabelText('Back to top')).not.toBeInTheDocument();
    });
  });

  it('handles file parsing errors gracefully', async () => {
    const parseFileMock = fileParser.parseFile as vi.Mock;
    parseFileMock.mockRejectedValue(new Error('Parse error'));

    render(<App />);
    const selectFilesButton = screen.getByText('Select Files');
    await act(async () => {
        fireEvent.click(selectFilesButton);
    });

    await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
        expect(screen.getByText('Failed to parse file')).toBeInTheDocument();
    });
  });
});
