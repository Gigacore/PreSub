import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MetadataDisplay } from './MetadataDisplay';
import type { ProcessedFile } from '../../App';
import * as nlp from '../../lib/analysis/nlp';

vi.mock('../../lib/analysis/nlp');

const mockMetadata: ProcessedFile['metadata'] = {
  author: 'Test Author',
  creator: 'Test Creator',
  lastModifiedBy: 'Another Person',
  pages: 10,
  hiddenField: 'should not be visible',
};

describe('MetadataDisplay', () => {
    beforeEach(() => {
        (nlp.classifyNamedEntitySpans as vi.Mock).mockImplementation(async (text) => {
            if (text === 'Test Author') {
                return {
                    available: true,
                    spans: [{ text: 'Test Author', label: 'PER', start: 0, end: 11, score: 0.9 }],
                };
            }
            return {
                available: true,
                spans: [],
            };
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

  it('renders priority and regular metadata fields', async () => {
    await act(async () => {
        render(<MetadataDisplay metadata={mockMetadata} ignoredKeys={new Set()} toggleIgnore={() => {}} />);
    });
    expect(screen.getByText('AUTHOR')).toBeInTheDocument();
    expect(screen.getByText('Test Author')).toBeInTheDocument();
    expect(screen.getByText('PAGES')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('does not render hidden fields', async () => {
    await act(async () => {
        render(<MetadataDisplay metadata={mockMetadata} ignoredKeys={new Set()} toggleIgnore={() => {}} />);
    });
    expect(screen.queryByText('hiddenField')).not.toBeInTheDocument();
  });

  it('shows a dismiss button for highlightable fields', async () => {
    await act(async () => {
        render(<MetadataDisplay metadata={mockMetadata} ignoredKeys={new Set()} toggleIgnore={() => {}} />);
    });
    expect(screen.getAllByRole('button', { name: 'Dismiss' })[0]).toBeInTheDocument();
  });

  it('calls toggleIgnore when dismiss is clicked', async () => {
    const toggleIgnore = vi.fn();
    await act(async () => {
        render(<MetadataDisplay metadata={mockMetadata} ignoredKeys={new Set()} toggleIgnore={toggleIgnore} />);
    });
    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismissButtons[0]);
    expect(toggleIgnore).toHaveBeenCalledWith('author');
  });

  it('shows a flag button when a key is ignored', async () => {
    await act(async () => {
        render(<MetadataDisplay metadata={mockMetadata} ignoredKeys={new Set(['author'])} toggleIgnore={() => {}} />);
    });
    expect(screen.getByRole('button', { name: 'Flag' })).toBeInTheDocument();
  });

  it('renders highlighted entities when NLP processing is complete', async () => {
    await act(async () => {
        render(<MetadataDisplay metadata={mockMetadata} ignoredKeys={new Set()} toggleIgnore={() => {}} />);
    });

    await waitFor(() => {
        expect(screen.getByText('PER')).toBeInTheDocument();
    });
  });

  it('handles NLP errors gracefully', async () => {
    (nlp.classifyNamedEntitySpans as vi.Mock).mockRejectedValue(new Error('NLP Error'));
    await act(async () => {
        render(<MetadataDisplay metadata={mockMetadata} ignoredKeys={new Set()} toggleIgnore={() => {}} />);
    });

    await waitFor(() => {
        expect(screen.getByText('Test Author')).toBeInTheDocument();
        expect(screen.queryByText('PER')).not.toBeInTheDocument();
    });
  });
});
