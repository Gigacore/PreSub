// Helper: treat any metadata value containing "LaTeX" (any case) as non-issue
export function containsLatex(value: unknown): boolean {
  return typeof value === 'string' && /latex/i.test(value);
}
