import { useState } from 'react';
import Header from './components/Header';
import FileDropzone from './components/FileDropzone';
import Results from './components/Results';
import { parseFile } from './lib/file-parser';

export interface ProcessedFile {
  fileName: string;
  potentialIssue?: {
    type: string;
    value: string;
  };
  metadata: {
    [key: string]: string | number | boolean | null | undefined;
  };
}

function App() {
  const [results, setResults] = useState<ProcessedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFiles = async (files: File[]) => {
    setIsLoading(true);
    const newResults = await Promise.all(
      files.map(async (file) => {
        try {
          return await parseFile(file);
        } catch (error) {
          console.error('Error parsing file:', error);
          return {
            fileName: file.name,
            metadata: {
              error: 'Failed to parse file',
            },
          };
        }
      })
    );
    setResults((prevResults) => [...prevResults, ...newResults]);
    setIsLoading(false);
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      <main className="container mx-auto max-w-4xl p-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <Header />
          <FileDropzone onFilesSelected={handleFiles} />
          {isLoading && <p className="text-center mt-4">Processing files...</p>}
          {results.length > 0 && (
            <Results results={results} onClear={clearResults} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
