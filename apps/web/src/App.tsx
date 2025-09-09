import React, { useState } from 'react';
import { AnalysisResult, analyzeFile } from 'core';

export function App() {
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setError(null);
    setResults(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      if (file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        setError('This file type is not supported in the browser. Please use the desktop app or CLI for full analysis.');
        return;
      }
      try {
        const buffer = await file.arrayBuffer();
        const analysisResult = await analyzeFile(new Uint8Array(buffer));
        setResults(analysisResult);
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
