import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('core', {
  analyze: (filePath: string) => ipcRenderer.invoke('core:analyze', filePath),
  sanitize: (filePath: string) => ipcRenderer.invoke('core:sanitize', filePath),
});
