import type { ProcessedFile } from '../../App';

interface PotentialIssuesProps {
  issues: NonNullable<ProcessedFile['potentialIssues']>;
}

export function PotentialIssues({ issues }: PotentialIssuesProps) {
  if (!issues.length) return null;

  return (
    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
      <div className="flex items-start">
        <span aria-hidden className="material-symbols-outlined text-red-600 mr-3">error</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-red-800">
            {`Potential Issues (${issues.length})`}
          </p>
          <div className="mt-1 space-y-1 text-sm text-red-700">
            {issues.map((iss, idx) => (
              <div key={idx} className="break-words">
                <span className="font-semibold">{iss.type}</span>: {iss.value}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
