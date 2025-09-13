import { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import FileDropzone from './components/FileDropzone';
import Results from './components/Results';
import { parseFile } from './lib/file-parser';

export interface ProcessedFile {
  fileName: string;
  potentialIssues?: Array<{
    type: string;
    value: string;
  }>;
  metadata: {
    [key: string]: string | number | boolean | string[] | null | undefined | Record<string, unknown>;
  };
  contentFindings?: {
    emails: Array<{ value: string; pages: number[] }>;
    urls: Array<{ value: string; pages: number[] }>;
  };
  // Full EXIF map for image files (all tags flattened to human-readable values)
  exif?: Record<string, string | number | boolean | null>;
  // Object URL for image previews
  previewUrl?: string;
}

function App() {
  const [results, setResults] = useState<ProcessedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFiles = async (files: File[]) => {
    setIsLoading(true);
    const newResults = await Promise.all(
      files.map(async (file) => {
        try {
          const parsed = await parseFile(file);
          const isImage =
            (typeof file.type === 'string' && file.type.startsWith('image/')) ||
            /\.(jpe?g|png|svg|tiff?)$/i.test(file.name);
          if (isImage) {
            return { ...parsed, previewUrl: URL.createObjectURL(file) } as ProcessedFile;
          }
          return parsed;
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
    // Revoke any created object URLs to avoid memory leaks
    try {
      results.forEach((r) => {
        if (r.previewUrl) {
          URL.revokeObjectURL(r.previewUrl);
        }
      });
    } catch {}
    setResults([]);
  };

  return (
    <div className="min-h-screen font-sans p-4 sm:p-6 md:p-8">
      <main className="mx-auto max-w-6xl">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-4 sm:p-6 md:p-8">
          <Header />
          <FileDropzone onFilesSelected={handleFiles} />
          {isLoading && (
            <p className="text-center mt-4 text-gray-600">Processing files...</p>
          )}
          {results.length > 0 && (
            <Results results={results} onClear={clearResults} />
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;
