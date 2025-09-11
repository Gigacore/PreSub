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
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* File Name */}
      <div className="flex items-center mb-4">
        <svg
          className="w-6 h-6 text-gray-500 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h2 className="text-xl font-semibold text-gray-800">
          {result.fileName}
        </h2>
      </div>

      {/* Potential Issues */}
      {!!result.potentialIssues?.length && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-6">
          <div className="flex">
            <div className="py-1">
              <svg
                className="w-6 h-6 text-red-500 mr-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-5a1 1 0 112 0v-2a1 1 0 11-2 0v2zm0-6a1 1 0 011-1h0a1 1 0 110 2 1 1 0 01-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="font-bold">Potential issues detected:</p>
              <ul className="text-sm list-disc ml-5">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
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
                    className={`bg-gray-50 p-4 rounded-lg ${isHighlight ? 'border-2 border-dotted border-red-400' : ''}`}
                  >
                    <p className="text-gray-500 font-semibold">{formatLabel(String(key))}</p>
                    <p className="text-gray-800">{formatValue(value)}</p>
                  </div>
                );
              })}

              {/* Count-like fields next (if present) */}
              {countKeys.filter(keyIn).map((key) => {
                const value = (result.metadata as any)[key];
                return (
                  <div key={`count-${key}`} className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-500 font-semibold">{formatLabel(String(key))}</p>
                    <p className="text-gray-800">{formatValue(value)}</p>
                  </div>
                );
              })}

              {/* Date fields next (if present) */}
              {dateKeys.filter(keyIn).map((key) => {
                const value = (result.metadata as any)[key];
                return (
                  <div key={`date-${key}`} className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-500 font-semibold">{formatLabel(String(key))}</p>
                    <p className="text-gray-800">{formatValue(value)}</p>
                  </div>
                );
              })}

              {/* Remaining metadata fields */}
              {restEntries.map(([key, value]) => {
                const isHighlight = (key === 'author' || key === 'creator' || key === 'lastModifiedBy') && isNonEmpty(value);
                return (
                  <div
                    key={key}
                    className={`bg-gray-50 p-4 rounded-lg ${isHighlight ? 'border-2 border-dotted border-red-400' : ''}`}
                  >
                    <p className="text-gray-500 font-semibold">{formatLabel(key)}</p>
                    <p className="text-gray-800">{formatValue(value)}</p>
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
