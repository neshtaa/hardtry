import { contextBridge } from 'electron';

// Expose any safe APIs to the renderer process here
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});
