import { useMemo, useState } from 'react';
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
  const [ignoredKeys, setIgnoredKeys] = useState<Set<string>>(new Set());

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
      <div className="flex items-start gap-3 mb-6 border-b pb-4">
        <span aria-hidden="true" className="material-symbols-outlined text-red-500 mt-0.5">insert_drive_file</span>
        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 break-words">{result.fileName}</h2>
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
            const countKeys: string[] = ['wordCount', 'words', 'slides', 'pages', 'numberOfSheets'];
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
                !contentKeys.includes(k)
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
                        <div>
                          <p className="text-gray-500 font-semibold text-xs sm:text-sm">{formatLabel(String(key))}</p>
                          <p className="text-gray-800 text-xs sm:text-sm">{formatValue(value)}</p>
                        </div>
                        {isHighlightBase && (
                          <div className="shrink-0">
                            {!isIgnored ? (
                              <button
                                type="button"
                                onClick={() => toggleIgnore(key)}
                                className="text-xs sm:text-[0.8125rem] text-red-700 hover:text-red-800 underline underline-offset-2"
                              >
                                Ignore
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
                {countKeys.filter(keyIn).map((key) => {
                  const value = (result.metadata as any)[key];
                  return (
                    <div key={`count-${key}`} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <p className="text-gray-500 font-semibold text-xs sm:text-sm">{formatLabel(String(key))}</p>
                      <p className="text-gray-800 text-xs sm:text-sm">{formatValue(value)}</p>
                    </div>
                  );
                })}

                {/* Date fields next (if present) */}
                {dateKeys.filter(keyIn).map((key) => {
                  const value = (result.metadata as any)[key];
                  return (
                    <div key={`date-${key}`} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <p className="text-gray-500 font-semibold text-xs sm:text-sm">{formatLabel(String(key))}</p>
                      <p className="text-gray-800 text-xs sm:text-sm">{formatValue(value)}</p>
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
                      <p className="text-gray-800 text-xs sm:text-sm">{formatValue(value)}</p>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      </div>

      {/* Content Findings Section */}
      {(() => {
        const cf = result.contentFindings;
        const hasCF = cf && ((cf.emails?.length ?? 0) > 0 || (cf.urls?.length ?? 0) > 0);
        const legacyEmails = (result.metadata as any).emailsFound as string[] | undefined;
        const legacyUrls = (result.metadata as any).urlsFound as string[] | undefined;

        if (hasCF) {
          const rows = [
            ...(cf!.emails || []).map((e) => ({ type: 'Email', value: e.value, pages: e.pages })),
            ...(cf!.urls || []).map((u) => ({ type: 'URL', value: u.value, pages: u.pages })),
          ];
          return (
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Content Findings</h3>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Value</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Pages</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-xs text-gray-800 whitespace-nowrap">{r.type}</td>
                        <td className="px-4 py-2 text-xs text-blue-700 break-all">{r.value}</td>
                        <td className="px-4 py-2 text-xs text-gray-700 whitespace-nowrap">{r.pages.join(', ')}</td>
                      </tr>
                    ))}
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
