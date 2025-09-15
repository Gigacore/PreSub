import { useEffect, useMemo, useState } from 'react';
import type { ProcessedFile } from '../App';

interface ResultItemProps {
  result: ProcessedFile;
  onRemove?: () => void;
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

function ResultItem({ result, onRemove }: ResultItemProps) {
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
  // Dismiss/Flag state for research findings
  const [ackDismissed, setAckDismissed] = useState<Set<string>>(new Set());
  const [affDismissed, setAffDismissed] = useState<Set<string>>(new Set());

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

  const fileNameLower = result.fileName.toLowerCase();
  const fileType = String((result.metadata as any).fileType || '');
  const isImage = (
    fileNameLower.endsWith('.jpg') ||
    fileNameLower.endsWith('.jpeg') ||
    fileNameLower.endsWith('.png') ||
    fileNameLower.endsWith('.svg') ||
    fileNameLower.endsWith('.tif') ||
    fileNameLower.endsWith('.tiff') ||
    fileType.toLowerCase().includes('image')
  );
  const getFileIcon = () => {
    if (isImage) {
      return { icon: 'image', color: 'text-gray-500' } as const;
    }
    if (fileNameLower.endsWith('.ppt') || fileNameLower.endsWith('.pptx') || fileType.toLowerCase().includes('powerpoint')) {
      return { icon: 'slideshow', color: 'text-gray-500' } as const;
    }
    if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls') || fileType.toLowerCase().includes('excel') || fileType.toLowerCase().includes('sheet')) {
      return { icon: 'table', color: 'text-gray-500' } as const;
    }
    if (fileNameLower.endsWith('.json')) {
      return { icon: 'code', color: 'text-gray-500' } as const;
    }
    if (fileNameLower.endsWith('.csv') || fileNameLower.endsWith('.md') || fileNameLower.endsWith('.markdown')) {
      return { icon: 'text_snippet', color: 'text-gray-500' } as const;
    }
    // default doc-like icon
    return { icon: 'description', color: 'text-gray-500' } as const;
  };

  const headerIcon = getFileIcon();

  // Research Signals pulled from metadata
  const metaAny = result.metadata as any;
  const ackDetected = Boolean(metaAny.acknowledgementsDetected);
  const ackExcerpt = typeof metaAny.acknowledgementsExcerpt === 'string' ? metaAny.acknowledgementsExcerpt : '';
  const fundingDetected = Boolean(metaAny.fundingDetected);
  const fundingMentions: string[] = Array.isArray(metaAny.fundingMentions) ? metaAny.fundingMentions : [];
  const grantIds: string[] = Array.isArray(metaAny.grantIds) ? metaAny.grantIds : [];
  const affiliationsDetected = Boolean(metaAny.affiliationsDetected);
  const affiliationsGuesses: string[] = Array.isArray(metaAny.affiliationsGuesses) ? metaAny.affiliationsGuesses : [];
  const hasResearchSignals = ackDetected || fundingDetected || affiliationsDetected;
  const researchFindings = (result as any).researchFindings as
    | { acknowledgements: Array<{ text: string; pages: number[] }>; affiliations: Array<{ text: string; pages: number[] }> }
    | undefined;

  // Normalize a raw URL string into a safe, clickable href.
  // - Preserves existing schemes
  // - Adds https:// if missing
  const toSafeHref = (raw: string) => {
    const v = (raw || '').trim();
    if (!v) return '#';
    // If already has a scheme like http(s), ftp, etc.
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) return v;
    // If starts with // (protocol-relative)
    if (/^\/\//.test(v)) return `https:${v}`;
    // Common case: starts with www. or naked domain
    return `https://${v}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Card Header */}
      <div className="p-4 flex flex-wrap items-center justify-between gap-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isImage && result.previewUrl ? (
            <button
              type="button"
              aria-label={`Preview ${result.fileName}`}
              onClick={() => setPreviewOpen(true)}
              className="relative group h-10 w-10 shrink-0"
            >
              <img
                src={result.previewUrl}
                alt={result.fileName}
                className="h-10 w-10 rounded-md object-cover border border-gray-200 cursor-pointer"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 rounded-md bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span aria-hidden className="material-symbols-outlined text-white text-base">open_in_full</span>
              </div>
            </button>
          ) : (
            <span aria-hidden className={`material-symbols-outlined ${headerIcon.color}`}>{headerIcon.icon}</span>
          )}
          <h2 className="font-medium text-gray-800 truncate" title={result.fileName}>{result.fileName}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {result.previewUrl && !isImage && (
            <button
              type="button"
              aria-label={`Preview ${result.fileName}`}
              onClick={() => setPreviewOpen(true)}
              className="relative group h-10 w-10"
            >
              <img
                src={result.previewUrl}
                alt={result.fileName}
                className="h-10 w-10 rounded-md object-cover border border-gray-200 cursor-pointer"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 rounded-md bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span aria-hidden className="material-symbols-outlined text-white text-base">open_in_full</span>
              </div>
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${result.fileName}`}
              title="Remove"
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-500 cursor-pointer"
            >
              <span aria-hidden className="material-symbols-outlined">delete</span>
            </button>
          )}
        </div>
      </div>
      <div className="p-6 space-y-6">

      {/* Potential Issues */}
      {!!filteredIssues.length && (
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="flex items-start">
            <span aria-hidden className="material-symbols-outlined text-red-600 mr-3">error</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-red-800">
                {`Potential Issues (${filteredIssues.length})`}
              </p>
              <div className="mt-1 space-y-1 text-sm text-red-700">
                {filteredIssues.map((iss, idx) => (
                  <div key={idx} className="break-words">
                    <span className="font-semibold">{iss.type}</span>: {iss.value}
                  </div>
                ))}
              </div>
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
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-start">
              <span aria-hidden className="material-symbols-outlined text-blue-600 mr-3">lightbulb</span>
              <div>
                <p className="text-sm font-medium text-blue-800">Review Suggested</p>
                <p className="text-sm text-blue-700">
                  {`Found ${emailsCount} email${emailsCount === 1 ? '' : 's'} and ${urlsCount} URL${urlsCount === 1 ? '' : 's'} in the content. Please review details below.`}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Research Signals Banner (moved to top with other banners) */}
      {hasResearchSignals && (
        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
          <div className="flex items-start">
            <span aria-hidden className="material-symbols-outlined text-emerald-600 mr-3">science</span>
            <div>
              <p className="text-sm font-medium text-emerald-800">Research Signals Detected</p>
              <p className="text-sm text-emerald-700">
                {`${ackDetected ? 'Acknowledgements' : ''}${ackDetected && (fundingDetected || affiliationsDetected) ? ', ' : ''}${fundingDetected ? 'Funding' : ''}${(ackDetected || fundingDetected) && affiliationsDetected ? ', ' : ''}${affiliationsDetected ? 'Affiliations' : ''} present. See details below.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metadata Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Metadata</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {(() => {
            const priorityKeys: string[] = ['author', 'creator', 'lastModifiedBy'];
            // Do not show wordCount, words, or totalTime anywhere
            const hiddenKeys: string[] = [
              'wordCount', 'words', 'totalTime', 'exif',
              // Hide research signal fields; they have their own section
              'acknowledgementsDetected', 'acknowledgementsExcerpt',
              'fundingDetected', 'fundingMentions', 'grantIds',
              'affiliationsDetected', 'affiliationsGuesses',
            ];
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
                                className="text-xs sm:text-[0.8125rem] text-red-700 hover:text-red-800 underline underline-offset-2 cursor-pointer"
                              >
                                Dismiss
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleIgnore(key)}
                                className="text-xs sm:text-[0.8125rem] text-gray-600 hover:text-gray-800 underline underline-offset-2 cursor-pointer"
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

      {/* Research Signals Section moved below Content Findings */}

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
              className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full shadow-md border border-gray-200 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-500 flex items-center justify-center h-9 w-9"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-base">close</span>
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
          const fileNameLower = result.fileName.toLowerCase();
          const isPdf = fileType === 'PDF' || fileNameLower.endsWith('.pdf');
          const isDoc = fileType.includes('MICROSOFT WORD DOCUMENT') || fileNameLower.endsWith('.docx') || fileNameLower.endsWith('.doc');
          const isPpt = fileType.includes('POWERPOINT') || fileNameLower.endsWith('.pptx') || fileNameLower.endsWith('.ppt');
          const positionLabel = useLineLabel
            ? 'Line'
            : isPdf || isDoc
              ? 'Page(s)'
              : isPpt
                ? 'Slide(s)'
                : 'Pages';

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
              {/* Mobile: card list */}
              <ul className="md:hidden space-y-2">
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
                    <li
                      key={i}
                      className={`bg-white rounded-lg border border-gray-200 p-3 ${checked ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          aria-label={`Mark ${r.type} ${r.value} as reviewed`}
                          checked={checked}
                          onChange={toggle}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-semibold tracking-wide uppercase ${checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{r.type}</span>
                            <span className={`text-[10px] text-gray-500 ${checked ? 'line-through' : ''}`}>• {positionLabel}: {r.pages.join(', ')}</span>
                          </div>
                          <div className={`text-xs break-words ${checked ? 'text-gray-400 line-through' : 'text-blue-700'}`}>
                            {r.type === 'URL' ? (
                              <a
                                href={toSafeHref(r.value)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`${checked ? 'pointer-events-none' : 'hover:underline'} break-words`}
                              >
                                {r.value}
                              </a>
                            ) : (
                              r.value
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Desktop/tablet: table view */}
              <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
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
                          <td className={`px-4 py-2 text-xs break-all ${checked ? 'text-gray-400 line-through' : 'text-blue-700'}`}>
                            {r.type === 'URL' ? (
                              <a
                                href={toSafeHref(r.value)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`${checked ? 'pointer-events-none' : 'hover:underline'} break-all`}
                                title={r.value}
                              >
                                {r.value}
                              </a>
                            ) : (
                              r.value
                            )}
                          </td>
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
                      <a
                        key={i}
                        href={toSafeHref(u)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs sm:text-sm bg-white text-blue-800 border border-blue-200 rounded-md px-2 py-1 break-all hover:underline"
                        title={u}
                      >
                        {u}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Research Signals Banner removed from here; now shown above */}

      {/* Research Signals Section */}
      {(hasResearchSignals || researchFindings) && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Research Signals</h3>
          <div className="space-y-4">
            {/* Acknowledgements with actions */}
            {ackDetected && (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex items-start gap-2">
                  <span aria-hidden className="material-symbols-outlined text-gray-600">handshake</span>
                  <div className="min-w-0 w-full">
                    {(() => {
                      const items = researchFindings?.acknowledgements || [];
                      const fileType = String((result.metadata as any).fileType || '').toUpperCase();
                      const useLineLabel = fileType === 'JSON' || fileType === 'MARKDOWN' || fileType === 'CSV';
                      const fileNameLower = result.fileName.toLowerCase();
                      const isPdf = fileType === 'PDF' || fileNameLower.endsWith('.pdf');
                      const isDoc = fileType.includes('MICROSOFT WORD DOCUMENT') || fileNameLower.endsWith('.docx') || fileNameLower.endsWith('.doc');
                      const isPpt = fileType.includes('POWERPOINT') || fileNameLower.endsWith('.pptx') || fileNameLower.endsWith('.ppt');
                      const positionLabel = useLineLabel ? 'Line' : isPdf || isDoc ? 'Page(s)' : isPpt ? 'Slide(s)' : 'Pages';
                      const flaggedCount = Math.max(0, items.length - ackDismissed.size);
                      return (
                        <div>
                          <p className="text-sm font-semibold text-gray-800">Acknowledgements <span className="ml-1 text-xs text-gray-600">({flaggedCount} mentions)</span></p>
                          {items.length > 0 ? (
                            <ul className="mt-2 space-y-2">
                              {items.map((it, i) => {
                                const id = `${it.text}:${it.pages.join('|')}`;
                                const dismissed = ackDismissed.has(id);
                                return (
                                  <li key={i} className={`flex items-start gap-3 ${dismissed ? 'opacity-70' : ''}`}>
                                    <div className="min-w-0 flex-1">
                                      <p className={`text-sm ${dismissed ? 'text-gray-400 line-through' : 'text-gray-700'} break-words`}>{it.text}</p>
                                      <p className={`text-xs ${dismissed ? 'text-gray-300 line-through' : 'text-gray-500'} mt-0.5`}>{positionLabel}: {it.pages.join(', ')}</p>
                                    </div>
                                    <div className="shrink-0">
                                      {!dismissed ? (
                                        <button type="button" onClick={() => setAckDismissed((prev) => { const n = new Set(prev); n.add(id); return n; })} className="text-xs text-red-700 hover:text-red-800 underline underline-offset-2 cursor-pointer">Dismiss</button>
                                      ) : (
                                        <button type="button" onClick={() => setAckDismissed((prev) => { const n = new Set(prev); n.delete(id); return n; })} className="text-xs text-gray-600 hover:text-gray-800 underline underline-offset-2 cursor-pointer">Flag</button>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <>
                              <p className="text-sm text-gray-500">Acknowledgements section or phrasing detected.</p>
                              {ackExcerpt && <p className="mt-1 text-sm text-gray-700 break-words">{ackExcerpt}</p>}
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {fundingDetected && (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex items-start gap-2">
                  <span aria-hidden className="material-symbols-outlined text-gray-600">payments</span>
                  <div className="min-w-0 w-full">
                    <p className="text-sm font-semibold text-gray-800">Funding</p>
                    {fundingMentions.length > 0 ? (
                      <ul className="mt-2 list-disc list-inside space-y-1 text-sm text-gray-700">
                        {fundingMentions.map((f, i) => (
                          <li key={i} className="break-words">{f}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-gray-500">Funding statements detected.</p>
                    )}
                    {!!grantIds.length && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {grantIds.map((g, i) => (
                          <span key={i} className="text-xs bg-white text-gray-800 border border-gray-300 rounded-md px-2 py-1">{g}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Affiliations with actions */}
            {affiliationsDetected && (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex items-start gap-2">
                  <span aria-hidden className="material-symbols-outlined text-gray-600">account_balance</span>
                  <div className="min-w-0 w-full">
                    {(() => {
                      const items = researchFindings?.affiliations || [];
                      const fileType = String((result.metadata as any).fileType || '').toUpperCase();
                      const useLineLabel = fileType === 'JSON' || fileType === 'MARKDOWN' || fileType === 'CSV';
                      const fileNameLower = result.fileName.toLowerCase();
                      const isPdf = fileType === 'PDF' || fileNameLower.endsWith('.pdf');
                      const isDoc = fileType.includes('MICROSOFT WORD DOCUMENT') || fileNameLower.endsWith('.docx') || fileNameLower.endsWith('.doc');
                      const isPpt = fileType.includes('POWERPOINT') || fileNameLower.endsWith('.pptx') || fileNameLower.endsWith('.ppt');
                      const positionLabel = useLineLabel ? 'Line' : isPdf || isDoc ? 'Page(s)' : isPpt ? 'Slide(s)' : 'Pages';
                      const flaggedCount = Math.max(0, items.length - affDismissed.size);
                      return (
                        <div>
                          <p className="text-sm font-semibold text-gray-800">Affiliations <span className="ml-1 text-xs text-gray-600">({flaggedCount} mentions)</span></p>
                          {items.length > 0 ? (
                            <ul className="mt-2 space-y-2">
                              {items.map((it, i) => {
                                const id = `${it.text}:${it.pages.join('|')}`;
                                const dismissed = affDismissed.has(id);
                                return (
                                  <li key={i} className={`flex items-start gap-3 ${dismissed ? 'opacity-70' : ''}`}>
                                    <div className="min-w-0 flex-1">
                                      <p className={`text-sm ${dismissed ? 'text-gray-400 line-through' : 'text-gray-700'} break-words`}>{it.text}</p>
                                      <p className={`text-xs ${dismissed ? 'text-gray-300 line-through' : 'text-gray-500'} mt-0.5`}>{positionLabel}: {it.pages.join(', ')}</p>
                                    </div>
                                    <div className="shrink-0">
                                      {!dismissed ? (
                                        <button type="button" onClick={() => setAffDismissed((prev) => { const n = new Set(prev); n.add(id); return n; })} className="text-xs text-red-700 hover:text-red-800 underline underline-offset-2 cursor-pointer">Dismiss</button>
                                      ) : (
                                        <button type="button" onClick={() => setAffDismissed((prev) => { const n = new Set(prev); n.delete(id); return n; })} className="text-xs text-gray-600 hover:text-gray-800 underline underline-offset-2 cursor-pointer">Flag</button>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <>
                              <p className="text-sm text-gray-500">Affiliation cues detected near author block.</p>
                              {affiliationsGuesses.length > 0 && (
                                <ul className="mt-2 list-disc list-inside space-y-1 text-sm text-gray-700">
                                  {affiliationsGuesses.map((a, i) => (
                                    <li key={i} className="break-words">{a}</li>
                                  ))}
                                </ul>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default ResultItem;
