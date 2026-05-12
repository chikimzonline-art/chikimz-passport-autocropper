const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog operations
  selectInputFolder: () => ipcRenderer.invoke('dialog:selectInputFolder'),
  selectOutputFolder: () => ipcRenderer.invoke('dialog:selectOutputFolder'),

  // File system operations
  listImages: (folderPath) => ipcRenderer.invoke('fs:listImages', folderPath),
  readImageAsBase64: (filePath) => ipcRenderer.invoke('fs:readImageAsBase64', filePath),
  saveCroppedImage: (outputFolder, originalName, base64Data) =>
    ipcRenderer.invoke('fs:saveCroppedImage', { outputFolder, originalName, base64Data }),

  // App info
  getResourcePath: () => ipcRenderer.invoke('app:getResourcePath'),

  // Dialogs
  showInfo: (title, message) => ipcRenderer.invoke('dialog:showInfo', { title, message }),
  showError: (title, message) => ipcRenderer.invoke('dialog:showError', { title, message }),

  // Get the real file path for a dropped File object (Electron-only API)
  // webUtils.getPathForFile is the safe replacement for file.path (deprecated)
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return null;
    }
  },

  // Check if running in Electron (always true when this preload is loaded)
  isElectron: true,
});
