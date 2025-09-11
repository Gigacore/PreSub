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
  return (
    <div className="bg-white rounded-2xl">
      {/* File Name */}
      <div className="flex items-start gap-3 mb-6 border-b pb-4">
        <span aria-hidden="true" className="material-symbols-outlined text-red-500 mt-0.5">insert_drive_file</span>
        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 break-words">{result.fileName}</h2>
      </div>

      {/* Potential Issues */}
      {!!result.potentialIssues?.length && (
        <div className="bg-red-100 p-4 rounded-xl border border-red-300 ring-2 ring-red-200 mb-6">
          <div className="flex items-center">
            <span aria-hidden="true" className="material-symbols-outlined text-red-600 mr-3">error</span>
            <div>
              <p className="text-sm font-medium text-red-800">POTENTIAL ISSUE</p>
              <ul className="text-sm text-red-900 list-disc ml-5">
                {result.potentialIssues.map((iss, idx) => (
                  <li key={idx}>
                    <span className="font-semibold">{iss.type}</span>: {iss.value}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

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
                  const isHighlight = (key === 'author' || key === 'creator' || key === 'lastModifiedBy') && isNonEmpty(value);
                  return (
                    <div
                      key={`priority-${key}`}
                      className={`bg-gray-50 p-4 rounded-xl border border-gray-200 ${isHighlight ? 'ring-2 ring-red-200' : ''}`}
                    >
                      <p className="text-gray-500 font-semibold text-xs sm:text-sm">{formatLabel(String(key))}</p>
                      <p className="text-gray-800 text-xs sm:text-sm">{formatValue(value)}</p>
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
        const emails = (result.metadata as any).emailsFound as string[] | undefined;
        const urls = (result.metadata as any).urlsFound as string[] | undefined;
        if (!emails && !urls) return null;
        return (
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Content Findings</h3>
            <div className="space-y-4">
              {!!emails?.length && (
                <div className="w-full bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                  <p className="text-yellow-800 font-semibold text-xs sm:text-sm mb-2">Emails Found</p>
                  <div className="flex flex-wrap gap-2">
                    {emails.map((e, i) => (
                      <span key={i} className="text-xs sm:text-sm bg-white text-yellow-800 border border-yellow-200 rounded-md px-2 py-1 break-all">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {!!urls?.length && (
                <div className="w-full bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <p className="text-blue-800 font-semibold text-xs sm:text-sm mb-2">URLs Found</p>
                  <div className="flex flex-wrap gap-2">
                    {urls.map((u, i) => (
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
