/// <reference path="renderer.d.ts" />
import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { AnalysisResult } from 'core';
import './App.css';

// SVG Icons as React components
const UploadIcon = () => (
  <svg className="dropzone-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 15v-6m0 0l-3 3m3-3l3 3" />
  </svg>
);

const CriticalIcon = () => (
  <svg className="alert-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const WarningIcon = () => (
  <svg className="alert-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

function App() {
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (results && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [results]);

  const processFile = useCallback(async (filePath: string) => {
    setError(null);
    setResults(null);
    try {
      const analysisResult = await window.core.analyze(filePath);
      setResults(analysisResult);
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        const file = files[0];
        const filePath = (file as any).path;
        if (filePath) {
          processFile(filePath);
        } else {
          setError('Could not get file path. This app works best in Electron.');
        }
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(async () => {
    const filePath = await window.core.openFile();
    if (filePath) {
      processFile(filePath);
    }
  }, [processFile]);

  return (
    <div className="container">
      <div className="header">
        <h1>Metadata Anonymity Checker</h1>
        <p>Check your files for hidden metadata before publishing.</p>
      </div>

      <div
        className={`dropzone ${isDragging ? 'dragging' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleFileSelect}
      >
        <UploadIcon />
        <div>
          <p>Drag and drop your files here, or click to select.</p>
          <span>Supports .docx, .pptx, .xlsx, .pdf</span>
        </div>
        <div>
          <button className="select-button" type="button">Select File</button>
        </div>
      </div>

      {error && (
        <div className="alert alert-critical" style={{ marginTop: '20px' }}>
            <CriticalIcon />
            <div className="alert-content">
                <h6>Error</h6>
                <p>{error}</p>
            </div>
        </div>
      )}

      {results && (
        <div className="results-container" ref={resultsRef}>
          <h2 className="results-header">Analysis Results</h2>

          {results.critical.length > 0 && (
            <div>
              {results.critical.map((item) => (
                <div key={item.id} className="alert alert-critical">
                  <CriticalIcon />
                  <div className="alert-content">
                    <h6>Critical</h6>
                    <p>{item.description}</p>
                    <p>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.warning.length > 0 && (
            <div>
              {results.warning.map((item) => (
                <div key={item.id} className="alert alert-warning">
                  <WarningIcon />
                  <div className="alert-content">
                    <h6>Warning</h6>
                    <p>{item.description}</p>
                    <p>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.info.length > 0 && (
            <div>
              {results.info.map((item) => (
                <div key={item.id} className="alert">
                  <div className="alert-content">
                    <h6>Info</h6>
                    <p>{item.description}</p>
                    <p>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
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
