import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Header from './Header';

describe('Header', () => {
  it('renders the header with the logo', () => {
    render(<Header />);
    const logoElement = screen.getByAltText(/PreSub logo/i);
    expect(logoElement).toBeInTheDocument();
  });
});
