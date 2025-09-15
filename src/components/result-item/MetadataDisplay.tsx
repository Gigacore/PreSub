import type { ProcessedFile } from '../../App';

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
  const priorityKeys: string[] = ['author', 'creator', 'lastModifiedBy'];
  const hiddenKeys: string[] = [
    'wordCount', 'words', 'totalTime', 'exif',
    'acknowledgementsDetected', 'acknowledgementsExcerpt',
    'fundingDetected', 'fundingMentions', 'grantIds',
    'affiliationsDetected', 'affiliationsGuesses',
  ];
  const countKeys: string[] = ['words', 'slides', 'pages', 'numberOfSheets'];
  const dateKeys: string[] = ['creationDate', 'modificationDate'];
  const contentKeys: string[] = ['emailsFound', 'urlsFound'];

  const entries = Object.entries(metadata);
  const keyIn = (k: string) => Object.prototype.hasOwnProperty.call(metadata, k);

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
      </div>
    </div>
  );
}
