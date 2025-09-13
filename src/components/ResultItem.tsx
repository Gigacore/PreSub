import { useEffect, useMemo, useState } from 'react';
import type { ProcessedFile } from '../App';

interface ResultItemProps {
  result: ProcessedFile;
}

function formatLabel(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .toUpperCase();
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : '-';
  }
  return String(value);
}

function isNonEmpty(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function ResultItem({ result }: ResultItemProps) {
  // Feature flag: toggle EXIF table/expand UI without removing code
  const ENABLE_EXIF_TABLE = false as const;
  const [ignoredKeys, setIgnoredKeys] = useState<Set<string>>(new Set());
  // Track which content-finding rows are reviewed (for strike-through)
  const [checkedFindings, setCheckedFindings] = useState<Set<string>>(new Set());
  // Filter Content Findings by domain (email domain or URL hostname)
  const [domainFilter, setDomainFilter] = useState<string>('');
  // EXIF collapsed by default for images
  const [exifOpen, setExifOpen] = useState<boolean>(false);
  // Lightbox preview for images
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewOpen]);

  const ISSUE_TYPE_BY_KEY: Record<string, string> = {
    author: 'AUTHOR FOUND',
    creator: 'CREATOR FOUND',
    lastModifiedBy: 'LAST MODIFIED BY FOUND',
  };

  const toggleIgnore = (key: string) => {
    setIgnoredKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredIssues = useMemo(() => {
    const ignoredTypes = new Set(
      Array.from(ignoredKeys)
        .map((k) => ISSUE_TYPE_BY_KEY[k])
        .filter(Boolean)
    );
    return (result.potentialIssues || []).filter((iss) => !ignoredTypes.has(iss.type));
  }, [ignoredKeys, result.potentialIssues]);

  return (
    <div className="bg-white rounded-2xl">
      {/* File Name */}
      <div className="flex items-start justify-between gap-3 mb-6 border-b pb-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="material-symbols-outlined text-red-500 mt-0.5">insert_drive_file</span>
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 break-words">{result.fileName}</h2>
        </div>
        {result.previewUrl && (
          <img
            src={result.previewUrl}
            alt={result.fileName}
            className="w-24 h-24 object-cover rounded-lg border border-gray-200 cursor-pointer"
            loading="lazy"
            onClick={() => setPreviewOpen(true)}
            title="Click to preview"
          />
        )}
      </div>

      {/* Potential Issues */}
      {!!filteredIssues.length && (
        <div className="bg-red-100 p-4 rounded-xl border border-red-300 ring-2 ring-red-200 mb-6">
          <div className="flex items-center">
            <span aria-hidden="true" className="material-symbols-outlined text-red-600 mr-3">error</span>
            <div>
              <p className="text-sm font-medium text-red-800">POTENTIAL ISSUE</p>
              <ul className="text-sm text-red-900 list-disc ml-5">
                {filteredIssues.map((iss, idx) => (
                  <li key={idx}>
                    <span className="font-semibold">{iss.type}</span>: {iss.value}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Content Review Info Banner (emails/urls found) */}
      {(() => {
        const cf = result.contentFindings;
        const legacyEmails = (result.metadata as any).emailsFound as string[] | undefined;
        const legacyUrls = (result.metadata as any).urlsFound as string[] | undefined;
        const emailsCount = (cf?.emails?.length ?? 0) || (legacyEmails?.length ?? 0);
        const urlsCount = (cf?.urls?.length ?? 0) || (legacyUrls?.length ?? 0);
        const hasContentSignals = emailsCount > 0 || urlsCount > 0;
        if (!hasContentSignals) return null;
        return (
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 ring-2 ring-blue-100 mb-6">
            <div className="flex items-start">
              <span aria-hidden="true" className="material-symbols-outlined text-blue-600 mr-3">info</span>
              <div>
                <p className="text-sm font-medium text-blue-800">Review Suggested</p>
                <p className="text-sm text-blue-900">
                  {`Found ${emailsCount} email${emailsCount === 1 ? '' : 's'} and ${urlsCount} URL${urlsCount === 1 ? '' : 's'} in the content. Please review details below.`}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Metadata Section */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Metadata</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {(() => {
            const priorityKeys: string[] = ['author', 'creator', 'lastModifiedBy'];
            // Do not show wordCount, words, or totalTime anywhere
            const hiddenKeys: string[] = ['wordCount', 'words', 'totalTime', 'exif'];
            const countKeys: string[] = ['words', 'slides', 'pages', 'numberOfSheets'];
            const dateKeys: string[] = ['creationDate', 'modificationDate'];
            // Content-derived keys we want to segregate
            const contentKeys: string[] = ['emailsFound', 'urlsFound'];

            const entries = Object.entries(result.metadata);
            const keyIn = (k: string) => Object.prototype.hasOwnProperty.call(result.metadata, k);

            const restEntries = entries.filter(
              ([k]) =>
                !priorityKeys.includes(k) &&
                !countKeys.includes(k) &&
                !dateKeys.includes(k) &&
                !contentKeys.includes(k) &&
                !hiddenKeys.includes(k)
            );

            return (
              <>
                {/* Priority fields on top, always shown */}
                {priorityKeys.map((key) => {
                  const value = (result.metadata as any)[key];
                  const isHighlightBase = (key === 'author' || key === 'creator' || key === 'lastModifiedBy') && isNonEmpty(value);
                  const isIgnored = ignoredKeys.has(key);
                  const isHighlight = isHighlightBase && !isIgnored;
                  return (
                    <div
                      key={`priority-${key}`}
                      className={`bg-gray-50 p-4 rounded-xl border border-gray-200 ${isHighlight ? 'ring-2 ring-red-200' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-gray-500 font-semibold text-xs sm:text-sm">{formatLabel(String(key))}</p>
                          <p className="text-gray-800 text-xs sm:text-sm line-clamp-2" title={formatValue(value)}>{formatValue(value)}</p>
                        </div>
                        {isHighlightBase && (
                          <div className="shrink-0">
                            {!isIgnored ? (
                              <button
                                type="button"
                                onClick={() => toggleIgnore(key)}
                                className="text-xs sm:text-[0.8125rem] text-red-700 hover:text-red-800 underline underline-offset-2"
                              >
                                Dismiss
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleIgnore(key)}
                                className="text-xs sm:text-[0.8125rem] text-gray-600 hover:text-gray-800 underline underline-offset-2"
                              >
                                Flag
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Count-like fields next (if present) */}
                {countKeys.filter((k) => keyIn(k) && !hiddenKeys.includes(k)).map((key) => {
                  const value = (result.metadata as any)[key];
                  return (
                    <div key={`count-${key}`} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <p className="text-gray-500 font-semibold text-xs sm:text-sm">{formatLabel(String(key))}</p>
                      <p className="text-gray-800 text-xs sm:text-sm line-clamp-2" title={formatValue(value)}>{formatValue(value)}</p>
                    </div>
                  );
                })}

                {/* Date fields next (if present) */}
                {dateKeys.filter(keyIn).map((key) => {
                  const value = (result.metadata as any)[key];
                  return (
                    <div key={`date-${key}`} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <p className="text-gray-500 font-semibold text-xs sm:text-sm">{formatLabel(String(key))}</p>
                      <p className="text-gray-800 text-xs sm:text-sm line-clamp-2" title={formatValue(value)}>{formatValue(value)}</p>
                    </div>
                  );
                })}

                {/* Remaining metadata fields */}
                {restEntries.map(([key, value]) => {
                  const isHighlight = (key === 'author' || key === 'creator' || key === 'lastModifiedBy') && isNonEmpty(value);
                  return (
                    <div
                      key={key}
                      className={`bg-gray-50 p-4 rounded-xl border border-gray-200 ${isHighlight ? 'ring-2 ring-red-200' : ''}`}
                    >
                      <p className="text-gray-500 font-semibold text-xs sm:text-sm">{formatLabel(key)}</p>
                      <p className="text-gray-800 text-xs sm:text-sm line-clamp-2" title={formatValue(value)}>{formatValue(value)}</p>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      </div>

      {/* EXIF Data Section (feature-flagged off; analysis still runs) */}
      {(() => {
        if (!ENABLE_EXIF_TABLE) return null;
        const exif = result.exif as Record<string, string | number | boolean | null> | undefined;
        if (!exif || !Object.keys(exif).length) return null;
        const entries = Object.entries(exif).sort((a, b) => a[0].localeCompare(b[0]));
        const count = entries.length;
        return (
          <div className="mb-6">
            <button
              type="button"
              aria-expanded={exifOpen}
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
              <div className="overflow-x-auto rounded-xl border border-gray-200">
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
      })()}

      {/* Lightbox Preview */}
      {previewOpen && result.previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewOpen(false)}
        >
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={result.previewUrl}
              alt={result.fileName}
              className="max-w-[95vw] max-h-[85vh] object-contain rounded-lg shadow-2xl bg-white"
            />
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              aria-label="Close preview"
              className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full shadow-md border border-gray-200 p-2 hover:bg-gray-50"
            >
              <span aria-hidden="true" className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Content Findings Section */}
      {(() => {
        const cf = result.contentFindings;
        const hasCF = cf && ((cf.emails?.length ?? 0) > 0 || (cf.urls?.length ?? 0) > 0);
        const legacyEmails = (result.metadata as any).emailsFound as string[] | undefined;
        const legacyUrls = (result.metadata as any).urlsFound as string[] | undefined;

        if (hasCF) {
          const rows = [
            ...(cf!.emails || []).map((e) => ({ type: 'Email' as const, value: e.value, pages: e.pages })),
            ...(cf!.urls || []).map((u) => ({ type: 'URL' as const, value: u.value, pages: u.pages })),
          ];

          const fileType = String((result.metadata as any).fileType || '').toUpperCase();
          const useLineLabel = fileType === 'JSON' || fileType === 'MARKDOWN' || fileType === 'CSV';
          const positionLabel = useLineLabel ? 'Line' : 'Pages';

          const extractDomain = (type: 'Email' | 'URL', value: string) => {
            try {
              if (type === 'Email') {
                const at = value.lastIndexOf('@');
                if (at !== -1) return value.slice(at + 1).trim().toLowerCase();
                return '';
              }
              // URL
              let host = '';
              try {
                host = new URL(value).hostname;
              } catch {
                // fallback: naive parse
                const m = value.match(/^[a-zA-Z]+:\/\/(?:[^@\n]+@)?([^\/:?#\n]+)/);
                host = m?.[1] || '';
              }
              host = host.trim().toLowerCase();
              if (host.startsWith('www.')) host = host.slice(4);
              return host;
            } catch {
              return '';
            }
          };

          const allDomains = rows
            .map((r) => extractDomain(r.type, r.value))
            .filter((d) => d.length > 0);
          const uniqueDomains = Array.from(new Set(allDomains)).sort((a, b) => a.localeCompare(b));

          const filteredRows = domainFilter
            ? rows.filter((r) => {
                const d = extractDomain(r.type, r.value);
                return d === domainFilter || d.endsWith(`.${domainFilter}`);
              })
            : rows;
          return (
            <div className="mb-2">
              {/* Divider above Content Findings section with padding */}
              <div className="my-4 h-px bg-gray-200" />
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-gray-700">Content Findings</h3>
                {/* Domain Filter aligned right */}
                <div className="flex items-center gap-2">
                  <label htmlFor="domain-filter" className="text-xs text-gray-600">Filter by domain</label>
                  <select
                    id="domain-filter"
                    value={domainFilter}
                    onChange={(e) => setDomainFilter(e.target.value)}
                    className="text-xs rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All domains</option>
                    {uniqueDomains.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 w-10 text-left text-xs font-semibold text-gray-600" aria-label="Reviewed" title="Reviewed">&nbsp;</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Value</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">{positionLabel}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredRows.map((r, i) => {
                      const id = `${r.type}:${r.value}:${r.pages.join('|')}`;
                      const checked = checkedFindings.has(id);
                      const toggle = () =>
                        setCheckedFindings((prev) => {
                          const next = new Set(prev);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          return next;
                        });
                      return (
                        <tr key={i}>
                          <td className="px-3 py-2 align-top">
                            <input
                              type="checkbox"
                              aria-label={`Mark ${r.type} ${r.value} as reviewed`}
                              checked={checked}
                              onChange={toggle}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className={`px-4 py-2 text-xs whitespace-nowrap ${checked ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{r.type}</td>
                          <td className={`px-4 py-2 text-xs break-all ${checked ? 'text-gray-400 line-through' : 'text-blue-700'}`}>{r.value}</td>
                          <td className={`px-4 py-2 text-xs whitespace-nowrap ${checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{r.pages.join(', ')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        // Fallback to legacy chips if page data isn't available
        if (!legacyEmails && !legacyUrls) return null;
        return (
          <div className="mb-2">
            {/* Divider above Content Findings section with padding */}
            <div className="my-4 h-px bg-gray-200" />
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Content Findings</h3>
            <div className="space-y-4">
              {!!legacyEmails?.length && (
                <div className="w-full bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                  <p className="text-yellow-800 font-semibold text-xs sm:text-sm mb-2">Emails Found</p>
                  <div className="flex flex-wrap gap-2">
                    {legacyEmails.map((e, i) => (
                      <span key={i} className="text-xs sm:text-sm bg-white text-yellow-800 border border-yellow-200 rounded-md px-2 py-1 break-all">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {!!legacyUrls?.length && (
                <div className="w-full bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <p className="text-blue-800 font-semibold text-xs sm:text-sm mb-2">URLs Found</p>
                  <div className="flex flex-wrap gap-2">
                    {legacyUrls.map((u, i) => (
                      <span key={i} className="text-xs sm:text-sm bg-white text-blue-800 border border-blue-200 rounded-md px-2 py-1 break-all">
                        {u}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default ResultItem;
