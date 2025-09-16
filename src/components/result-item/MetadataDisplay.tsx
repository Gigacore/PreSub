import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ProcessedFile } from '../../App';
import { classifyNamedEntitySpans } from '../../lib/analysis/nlp';

type HighlightSegment = {
  text: string;
  label?: string;
};

const ENTITY_STYLES: Record<string, { text: string; background: string; tag: string }> = {
  ORG: { text: '#115E59', background: '#CCFBF1', tag: '#14B8A6' },
  PER: { text: '#9D174D', background: '#FCE7F3', tag: '#EC4899' },
  LOC: { text: '#86198F', background: '#FAE8FF', tag: '#D946EF' },
};

const DEFAULT_ENTITY_STYLE = { text: '#1F2937', background: '#E5E7EB', tag: '#6B7280' };
const HIGHLIGHT_KEYS = ['author', 'creator', 'lastModifiedBy'] as const;
const HIGHLIGHT_KEY_SET = new Set<string>(HIGHLIGHT_KEYS);

interface MetadataDisplayProps {
  metadata: ProcessedFile['metadata'];
  ignoredKeys: Set<string>;
  toggleIgnore: (key: string) => void;
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

export function MetadataDisplay({ metadata, ignoredKeys, toggleIgnore }: MetadataDisplayProps) {
  const [entitySegments, setEntitySegments] = useState<Record<string, HighlightSegment[] | null>>({});

  const priorityKeys: string[] = ['author', 'creator', 'lastModifiedBy'];
  const hiddenKeys: string[] = [
    'wordCount', 'words', 'totalTime', 'exif',
    'acknowledgementsDetected', 'acknowledgementsExcerpt',
    'fundingDetected', 'fundingMentions', 'grantIds',
    'affiliationsDetected', 'affiliationsGuesses',
    'nlpAnalysis', 'nlpModel', 'metadataNamedEntityCount', 'metadataNamedEntities',
  ];
  const countKeys: string[] = ['words', 'slides', 'pages', 'numberOfSheets'];
  const dateKeys: string[] = ['creationDate', 'modificationDate'];
  const contentKeys: string[] = ['emailsFound', 'urlsFound'];

  const entries = Object.entries(metadata);
  const keyIn = (k: string) => Object.prototype.hasOwnProperty.call(metadata, k);

  const authorRaw = metadata?.author as unknown;
  const creatorRaw = metadata?.creator as unknown;
  const lastModifiedByRaw = metadata?.lastModifiedBy as unknown;

  useEffect(() => {
    let cancelled = false;
    const sourceEntries: Array<[string, unknown]> = [
      ['author', authorRaw],
      ['creator', creatorRaw],
      ['lastModifiedBy', lastModifiedByRaw],
    ];

    const buildSegments = async (value: string): Promise<HighlightSegment[] | null> => {
      const trimmed = value.trim();
      if (!trimmed) return null;
      try {
        const result = await classifyNamedEntitySpans(trimmed);
        if (!result.available || !result.spans.length) return null;
        const segments: HighlightSegment[] = [];
        let cursor = 0;
        for (const span of result.spans) {
          const boundedStart = Math.max(0, Math.min(trimmed.length, span.start));
          const start = Math.max(cursor, boundedStart);
          const boundedEnd = Math.max(start, Math.min(trimmed.length, span.end));
          const end = Math.max(start, boundedEnd);
          if (start > cursor) {
            segments.push({ text: trimmed.slice(cursor, start) });
          }
          const highlighted = trimmed.slice(start, end);
          if (highlighted) {
            segments.push({ text: highlighted, label: span.label });
          }
          cursor = end;
        }
        if (cursor < trimmed.length) {
          segments.push({ text: trimmed.slice(cursor) });
        }
        return segments;
      } catch {
        return null;
      }
    };

    const load = async () => {
      const next: Record<string, HighlightSegment[] | null> = {};
      for (const [key, raw] of sourceEntries) {
        if (typeof raw !== 'string') {
          next[key] = null;
          continue;
        }
        const trimmedValue = raw.trim();
        if (!trimmedValue) {
          next[key] = null;
          continue;
        }
        next[key] = await buildSegments(trimmedValue);
      }
      if (!cancelled) {
        setEntitySegments(next);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [authorRaw, creatorRaw, lastModifiedByRaw]);

  const renderValue = useMemo(() => {
    return (key: string, value: unknown): { node: ReactNode; title: string } => {
      const fallback = formatValue(value);
      if (!HIGHLIGHT_KEY_SET.has(key)) {
        return { node: fallback, title: fallback };
      }

      if (typeof value !== 'string') {
        return { node: fallback, title: fallback };
      }

      const trimmed = value.trim();
      if (!trimmed) {
        return { node: '-', title: '-' };
      }

      const segments = entitySegments[key];
      if (!segments || segments.length === 0) {
        return { node: trimmed, title: trimmed };
      }

      return {
        node: (
          <span className="inline-flex flex-wrap gap-1">{
            segments.map((segment, index) => {
              if (!segment.label) {
                return (
                  <span key={`${key}-fragment-${index}`} className="whitespace-pre-wrap">
                    {segment.text}
                  </span>
                );
              }
              const style = ENTITY_STYLES[segment.label] ?? DEFAULT_ENTITY_STYLE;
              return (
                <span
                  key={`${key}-entity-${index}`}
                  className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium"
                  style={{
                    backgroundColor: style.background,
                    color: style.text,
                  }}
                >
                  <span className="whitespace-pre-wrap">{segment.text}</span>
                  <span
                    className="ml-1 rounded-sm px-1 py-px text-[0.6rem] font-semibold uppercase"
                    style={{
                      backgroundColor: style.tag,
                      color: style.background,
                    }}
                  >
                    {segment.label}
                  </span>
                </span>
              );
            })
          }</span>
        ),
        title: trimmed,
      };
    };
  }, [entitySegments]);

  const restEntries = entries.filter(
    ([k]) =>
      !priorityKeys.includes(k) &&
      !countKeys.includes(k) &&
      !dateKeys.includes(k) &&
      !contentKeys.includes(k) &&
      !hiddenKeys.includes(k)
  );

  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">Metadata</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Priority fields on top, always shown */}
        {priorityKeys.map((key) => {
          const value = (metadata as any)[key];
          const isHighlightBase = (key === 'author' || key === 'creator' || key === 'lastModifiedBy') && isNonEmpty(value);
          const isIgnored = ignoredKeys.has(key);
          const isHighlight = isHighlightBase && !isIgnored;
          const { node: displayValue, title } = renderValue(key, value);
          return (
            <div
              key={`priority-${key}`}
              className={`bg-gray-50 p-4 rounded-xl border border-gray-200 ${isHighlight ? 'ring-2 ring-red-200' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-gray-500 font-semibold text-xs sm:text-sm">{formatLabel(String(key))}</p>
                  <p className="text-gray-800 text-xs sm:text-sm line-clamp-2" title={title}>{displayValue}</p>
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
          const value = (metadata as any)[key];
          return (
            <div key={`count-${key}`} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <p className="text-gray-500 font-semibold text-xs sm:text-sm">{formatLabel(String(key))}</p>
              <p className="text-gray-800 text-xs sm:text-sm line-clamp-2" title={formatValue(value)}>{formatValue(value)}</p>
            </div>
          );
        })}

        {/* Date fields next (if present) */}
        {dateKeys.filter(keyIn).map((key) => {
          const value = (metadata as any)[key];
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
          const { node: displayValue, title } = renderValue(key, value);
          return (
            <div
              key={key}
              className={`bg-gray-50 p-4 rounded-xl border border-gray-200 ${isHighlight ? 'ring-2 ring-red-200' : ''}`}
            >
              <p className="text-gray-500 font-semibold text-xs sm:text-sm">{formatLabel(key)}</p>
              <p className="text-gray-800 text-xs sm:text-sm line-clamp-2" title={title}>{displayValue}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
