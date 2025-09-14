import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Header from './Header';

describe('Header', () => {
  it('renders the header with the main heading', () => {
    render(<Header />);
    const headingElement = screen.getByRole('heading', { name: /PreSub/i, level: 1 });
    expect(headingElement).toBeInTheDocument();
  });
});
