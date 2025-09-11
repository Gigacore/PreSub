import type { ProcessedFile } from '../App';
import ResultItem from './ResultItem';

interface ResultsProps {
  results: ProcessedFile[];
  onClear: () => void;
}

function Results({ results, onClear }: ResultsProps) {
  return (
    <div className="mt-8 space-y-6" role="status">
      {results.map((result, index) => (
        <ResultItem key={index} result={result} />
      ))}
      <div className="text-right">
        <button
          onClick={onClear}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg"
        >
          Clear Results
        </button>
      </div>
    </div>
  );
}

export default Results;
