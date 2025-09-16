import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MetadataDisplay } from './MetadataDisplay';
import type { ProcessedFile } from '../../App';

const mockMetadata: ProcessedFile['metadata'] = {
  author: 'Test Author',
  creator: 'Test Creator',
  pages: 10,
  hiddenField: 'should not be visible',
};

describe('MetadataDisplay', () => {
  it('renders priority and regular metadata fields', () => {
    render(<MetadataDisplay metadata={mockMetadata} ignoredKeys={new Set()} toggleIgnore={() => {}} />);
    expect(screen.getByText('AUTHOR')).toBeInTheDocument();
    expect(screen.getByText('Test Author')).toBeInTheDocument();
    expect(screen.getByText('PAGES')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('does not render hidden fields', () => {
    render(<MetadataDisplay metadata={mockMetadata} ignoredKeys={new Set()} toggleIgnore={() => {}} />);
    expect(screen.queryByText('hiddenField')).not.toBeInTheDocument();
  });

  it('shows a dismiss button for highlightable fields', () => {
    render(<MetadataDisplay metadata={mockMetadata} ignoredKeys={new Set()} toggleIgnore={() => {}} />);
    expect(screen.getAllByRole('button', { name: 'Dismiss' })[0]).toBeInTheDocument();
  });

  it('calls toggleIgnore when dismiss is clicked', () => {
    const toggleIgnore = vi.fn();
    render(<MetadataDisplay metadata={mockMetadata} ignoredKeys={new Set()} toggleIgnore={toggleIgnore} />);
    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismissButtons[0]);
    expect(toggleIgnore).toHaveBeenCalledWith('author');
  });

  it('shows a flag button when a key is ignored', () => {
    render(<MetadataDisplay metadata={mockMetadata} ignoredKeys={new Set(['author'])} toggleIgnore={() => {}} />);
    expect(screen.getByRole('button', { name: 'Flag' })).toBeInTheDocument();
  });
});
