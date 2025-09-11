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

      {/* Metadata Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {(() => {
          const priorityKeys: string[] = ['author', 'creator', 'lastModifiedBy'];
          const countKeys: string[] = ['wordCount', 'words', 'slides', 'pages', 'numberOfSheets'];
          const dateKeys: string[] = ['creationDate', 'modificationDate'];

          const entries = Object.entries(result.metadata);
          const keyIn = (k: string) => Object.prototype.hasOwnProperty.call(result.metadata, k);

          const restEntries = entries.filter(
            ([k]) => !priorityKeys.includes(k) && !countKeys.includes(k) && !dateKeys.includes(k)
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
  );
}

export default ResultItem;
