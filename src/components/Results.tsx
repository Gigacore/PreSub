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
      <div className="mt-2 flex justify-start">
        <button
          onClick={onClear}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 px-6 rounded-lg transition duration-300 w-full sm:w-auto min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-500"
        >
          Clear Results
        </button>
      </div>
    </div>
  );
}

export default Results;
