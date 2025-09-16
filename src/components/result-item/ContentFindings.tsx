import { useState } from 'react';
import type { ProcessedFile } from '../../App';

interface ContentFindingsProps {
  result: ProcessedFile;
}

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

export function ContentFindings({ result }: ContentFindingsProps) {
  const [checkedFindings, setCheckedFindings] = useState<Set<string>>(new Set());
  const [domainFilter, setDomainFilter] = useState<string>('');

  const cf = result.contentFindings;
  const legacyEmails = (result.metadata as any).emailsFound as string[] | undefined;
  const legacyUrls = (result.metadata as any).urlsFound as string[] | undefined;

  const hasEmails = (cf?.emails?.length ?? 0) > 0;
  const hasUrls = (cf?.urls?.length ?? 0) > 0;
  const hasEntities = (cf?.entities?.length ?? 0) > 0;
  const hasStructuredFindings = hasEmails || hasUrls || hasEntities;

  if (!hasStructuredFindings) {
    if (!legacyEmails && !legacyUrls) return null;
    return (
      <div className="mb-2">
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
  }

  const rows =
    hasEmails || hasUrls
      ? [
          ...(cf?.emails || []).map((e) => ({ type: 'Email' as const, value: e.value, pages: e.pages })),
          ...(cf?.urls || []).map((u) => ({ type: 'URL' as const, value: u.value, pages: u.pages })),
        ]
      : [];

  const fileType = String((result.metadata as any).fileType || '').toUpperCase();
  const fileNameLower = result.fileName.toLowerCase();
  const useLineLabel = fileType === 'JSON' || fileType === 'MARKDOWN' || fileType === 'CSV';
  const isPdf = fileType === 'PDF' || fileNameLower.endsWith('.pdf');
  const isDoc =
    fileType.includes('MICROSOFT WORD DOCUMENT') ||
    fileNameLower.endsWith('.docx') ||
    fileNameLower.endsWith('.doc');
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
      let host = '';
      try {
        host = new URL(value).hostname;
      } catch {
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

  const allDomains = rows.map((r) => extractDomain(r.type, r.value)).filter((d) => d.length > 0);
  const uniqueDomains = Array.from(new Set(allDomains)).sort((a, b) => a.localeCompare(b));

  const filteredRows =
    domainFilter && rows.length
      ? rows.filter((r) => {
          const d = extractDomain(r.type, r.value);
          return d === domainFilter || d.endsWith(`.${domainFilter}`);
        })
      : rows;

  const entities = cf?.entities ?? [];
  const entityPositionLabel = cf?.entityPositionLabel ?? 'Occurrences';
  const nlpStatus = (result.metadata as any).nlpAnalysis as string | undefined;
  const nlpModel = (result.metadata as any).nlpModel as string | undefined;
  const nlpNote = (result.metadata as any).nlpAnalysisNote as string | undefined;
  const nlpFallbackReason = (result.metadata as any).nlpFallbackReason as string | undefined;
  const statusLineParts: string[] = [];
  if (nlpStatus) statusLineParts.push(nlpStatus);
  if (nlpModel) statusLineParts.push(`Model: ${nlpModel}`);
  const statusLine = statusLineParts.join(' • ');

  const toConfidence = (score: number) => `${Math.round(Math.min(Math.max(score, 0), 1) * 1000) / 10}%`;

  return (
    <div id="content-findings" className="mb-2 scroll-mt-16">
      <div className="my-4 h-px bg-gray-200" />
      <div className="mb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-700">Content Findings</h3>
        {(hasEmails || hasUrls) && (
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
        )}
      </div>

      {(hasEmails || hasUrls) && (
        <>
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
                        <span className={`text-[10px] text-gray-500 ${checked ? 'line-through' : ''}`}>
                          • {positionLabel}: {r.pages.join(', ')}
                        </span>
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
        </>
      )}

      {hasEntities && (
        <div className={`${hasEmails || hasUrls ? 'mt-6' : ''}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h4 className="text-xs sm:text-sm font-semibold text-gray-700">Named Entity Findings (NLP)</h4>
            {statusLine && <div className="text-[11px] sm:text-xs text-gray-500">{statusLine}</div>}
          </div>
          {nlpFallbackReason && <p className="text-xs text-red-600 mb-2">Fallback: {nlpFallbackReason}</p>}
          {nlpNote && <p className="text-xs text-gray-500 mb-2">{nlpNote}</p>}

          <ul className="md:hidden space-y-2">
            {entities.map((entity, index) => (
              <li key={`${entity.label}:${entity.value}:${index}`} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] uppercase text-gray-500 font-semibold">
                    <span>{entity.label}</span>
                    <span>{toConfidence(entity.averageScore)}</span>
                  </div>
                  <div className="text-sm text-gray-800 break-words">{entity.value}</div>
                  <div className="text-[11px] text-gray-600">
                    Occurrences: {entity.occurrences}
                    {entity.positions?.length ? (
                      <>
                        {' • '}
                        {entityPositionLabel}: {entity.positions.join(', ')}
                      </>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Entity</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Occurrences</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Confidence</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">{entityPositionLabel}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {entities.map((entity, index) => (
                  <tr key={`${entity.label}:${entity.value}:${index}`}>
                    <td className="px-4 py-2 text-xs text-gray-800 whitespace-nowrap">{entity.label}</td>
                    <td className="px-4 py-2 text-xs text-gray-900 break-words">{entity.value}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 whitespace-nowrap">{entity.occurrences}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 whitespace-nowrap">{toConfidence(entity.averageScore)}</td>
                    <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">{entity.positions?.length ? entity.positions.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
