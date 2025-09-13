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
    // Prepend newly processed files so they appear at the top
    setResults((prevResults) => [...newResults, ...prevResults]);
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

  const removeResultAt = (index: number) => {
    setResults((prev) => {
      const target = prev[index];
      try {
        if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      } catch {}
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <div className={`min-h-screen font-sans ${results.length === 0 ? 'bg-white' : 'bg-gray-50'}`}>
      {/* Header: full-width white background */}
      <div className="bg-white w-full">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Header />
        </div>
      </div>

      {/* File drop: full-width white background (no border) */}
      <div className="bg-white w-full">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="mx-auto w-full md:w-[70%]">
            <FileDropzone onFilesSelected={handleFiles} />
            {isLoading && (
              <p className="text-center mt-4 text-gray-600">Processing files...</p>
            )}
          </div>
        </div>
      </div>

      {/* Results container */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {results.length > 0 && (
          <Results results={results} onClear={clearResults} onRemove={removeResultAt} />
        )}
      </main>
      <Footer />
    </div>
  );
}

export default App;
