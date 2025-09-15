export function toISO(value: string | undefined) {
  if (!value) return undefined;
  // Handle common EXIF datetime format: YYYY:MM:DD HH:MM:SS
  let v = value.trim();
  const exifMatch = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(v);
  if (exifMatch) {
    const [, y, m, d, hh, mm, ss] = exifMatch;
    v = `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}
