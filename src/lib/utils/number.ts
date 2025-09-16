export function number(value: string | undefined) {
  const n = value ? Number(value) : NaN;
  return isNaN(n) ? undefined : n;
}

export function variance(values: number[]) {
  if (!values.length) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / values.length;
}
