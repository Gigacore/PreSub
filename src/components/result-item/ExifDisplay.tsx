import { useState } from 'react';
import type { ProcessedFile } from '../../App';

interface ExifDisplayProps {
  exif: ProcessedFile['exif'];
}

export function ExifDisplay({ exif }: ExifDisplayProps) {
  const [exifOpen, setExifOpen] = useState<boolean>(false);

  if (!exif || !Object.keys(exif).length) return null;
  const entries = Object.entries(exif).sort((a, b) => a[0].localeCompare(b[0]));
  const count = entries.length;

  return (
    <div className="mb-6">
      <button
        type="button"
        aria-expanded={exifOpen}
        aria-controls="exif-table"
        onClick={() => setExifOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 px-4 py-3 mb-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="material-symbols-outlined text-gray-700">photo_camera</span>
          <span className="text-sm font-semibold text-gray-800">EXIF Data</span>
          <span className="ml-2 text-xs text-gray-600">({count} tag{count === 1 ? '' : 's'})</span>
        </div>
        <span aria-hidden="true" className={`material-symbols-outlined text-gray-600 transition-transform ${exifOpen ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {exifOpen && (
        <div id="exif-table" className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Tag</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Value</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {entries.map(([k, v]) => (
                <tr key={k}>
                  <td className="px-4 py-2 align-top text-xs whitespace-nowrap text-gray-700">{k}</td>
                  <td className="px-4 py-2 align-top text-xs break-all text-gray-800">{v === null ? '-' : String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
