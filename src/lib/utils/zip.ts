import JSZip from 'jszip';

export async function safeReadText(zip: JSZip, path: string) {
  const file = zip.file(path);
  if (!file) return null;
  try {
    return await file.async('text');
  } catch {
    return null;
  }
}
