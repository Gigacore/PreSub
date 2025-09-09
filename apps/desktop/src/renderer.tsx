/// <reference path="renderer.d.ts" />
import React, { useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { AnalysisResult } from 'core';
import {
  Container,
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Alert,
  Button,
} from '@mui/material';

function App() {
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper
        elevation={3}
        sx={{
          p: 4,
          textAlign: 'center',
          border: `2px dashed ${isDragging ? 'primary.main' : 'grey.400'}`,
          backgroundColor: isDragging ? 'grey.50' : 'background.paper',
          transition: 'all 0.3s ease-in-out',
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Metadata Anonymity Checker
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Drag and drop your files here, or click to select.
        </Typography>
        <Button variant="contained" component="span" onClick={handleFileSelect}>
          Select File
        </Button>

        {error && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {error}
          </Alert>
        )}

        {results && (
          <Box sx={{ mt: 4, textAlign: 'left' }}>
            <Typography variant="h5" component="h2" gutterBottom>
              Analysis Results
            </Typography>

            {results.critical.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" component="h3" color="error.main">
                  Critical
                </Typography>
                <List dense>
                  {results.critical.map((item) => (
                    <ListItem key={item.id}>
                      <ListItemText primary={item.description} secondary={item.value} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {results.warning.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" component="h3" color="warning.main">
                  Warning
                </Typography>
                <List dense>
                  {results.warning.map((item) => (
                    <ListItem key={item.id}>
                      <ListItemText primary={item.description} secondary={item.value} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {results.info.length > 0 && (
              <Box>
                <Typography variant="h6" component="h3" color="info.main">
                  Info
                </Typography>
                <List dense>
                  {results.info.map((item) => (
                    <ListItem key={item.id}>
                      <ListItemText primary={item.description} secondary={item.value} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}
      </Paper>
    </Container>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
