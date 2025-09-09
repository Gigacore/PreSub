/// <reference path="renderer.d.ts" />
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { AnalysisResult } from 'core';

function App() {
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setError(null);
    setResults(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      try {
        // The 'path' property is not standard on the File object,
        // but Electron provides it.
        const filePath = (file as any).path;
        if (filePath) {
          const analysisResult = await window.core.analyze(filePath);
          setResults(analysisResult);
        } else {
          setError('Could not get file path. This app works best in Electron.');
        }
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div onDrop={handleDrop} onDragOver={handleDragOver} style={{ border: '2px dashed #ccc', padding: '20px', textAlign: 'center' }}>
      <h1>Metadata Anonymity Checker</h1>
      <p>Drag and drop your files here.</p>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {results && (
        <div>
          <h2>Analysis Results</h2>
          <h3>Critical</h3>
          <ul>
            {results.critical.map((item) => (
              <li key={item.id}>{item.description}: {item.value}</li>
            ))}
          </ul>
          <h3>Warning</h3>
          <ul>
            {results.warning.map((item) => (
              <li key={item.id}>{item.description}: {item.value}</li>
            ))}
          </ul>
          <h3>Info</h3>
          <ul>
            {results.info.map((item) => (
              <li key={item.id}>{item.description}: {item.value}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
