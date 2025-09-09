import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { analyzeFile, sanitizeFile } from 'core';

ipcMain.handle('core:analyze', async (event, filePath) => {
  const buffer = await fs.readFile(filePath);
  return analyzeFile(buffer);
});

ipcMain.handle('core:sanitize', async (event, filePath) => {
  const buffer = await fs.readFile(filePath);
  return sanitizeFile(buffer);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In development, load from Vite dev server
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    // Open the DevTools.
    win.webContents.openDevTools();
  } else {
    // In production, load the index.html file
    win.loadFile(path.join(__dirname, '../index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
