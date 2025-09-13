import type { ProcessedFile } from '../App';
import ResultItem from './ResultItem';

interface ResultsProps {
  results: ProcessedFile[];
  onClear: () => void;
  onRemove: (index: number) => void;
}

function Results({ results, onClear, onRemove }: ResultsProps) {
  return (
    <div className="space-y-8" role="status">
      {results.map((result, index) => (
        <ResultItem key={index} result={result} onRemove={() => onRemove(index)} />
      ))}
      <div className="mt-2 flex justify-start">
        <button
          onClick={onClear}
          className="text-gray-700 hover:text-gray-900 font-medium flex items-center gap-2 py-2 px-4 rounded-lg border border-gray-300 bg-white shadow-sm hover:bg-gray-50 transition w-full sm:w-auto min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-500"
        >
          <span aria-hidden className="material-symbols-outlined">delete_sweep</span>
          Clear Results
        </button>
      </div>
    </div>
  );
}

export default Results;
