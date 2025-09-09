import React, { useState, useCallback } from 'react';
import { AnalysisResult, analyzeFile } from 'core';
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
  Input,
} from '@mui/material';

export function App() {
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setResults(null);

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
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        processFile(files[0]);
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

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

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
          Drag and drop your .docx files here, or click to select.
        </Typography>
        <Input
          type="file"
          inputProps={{ accept: '.docx' }}
          onChange={handleFileSelect}
          sx={{ display: 'none' }}
          id="file-upload-button"
        />
        <label htmlFor="file-upload-button">
          <Button variant="contained" component="span">
            Select File
          </Button>
        </label>

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
