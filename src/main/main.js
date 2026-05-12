const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');

// Note: We do NOT disable hardware acceleration so MediaPipe can use GPU delegate.
// If you encounter GPU rendering issues on Linux, uncomment the line below:
// app.disableHardwareAcceleration();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Auto-Passport Crop — CSC Chikimz Online',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    icon: path.join(__dirname, '../../resources/icon.png'),
    show: false,
  });

  // In development, load from Vite dev server
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Prevent the default drag-and-drop behavior that would navigate
  // the window to the dropped file. We handle drops in the renderer.
  mainWindow.webContents.on('will-navigate', (event) => {
    // Allow navigation to localhost in dev mode, block everything else
    if (!mainWindow.webContents.getURL().startsWith('http://localhost')) {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ──────────────────────────────────────────────
// IPC Handlers
// ──────────────────────────────────────────────

/**
 * Open a folder selection dialog for input images
 */
ipcMain.handle('dialog:selectInputFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Input Folder',
    properties: ['openDirectory'],
    buttonLabel: 'Select Input Folder',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

/**
 * Open a folder selection dialog for output images
 */
ipcMain.handle('dialog:selectOutputFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Output Folder',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Select Output Folder',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

/**
 * List all image files in a given directory (top-level only, non-recursive)
 * Uses async fs.readdir to avoid blocking the main process.
 */
ipcMain.handle('fs:listImages', async (_event, folderPath) => {
  try {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff', '.tif'];
    const files = await fs.readdir(folderPath);
    const imageFiles = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return validExtensions.includes(ext);
      })
      .map((file) => ({
        name: file,
        fullPath: path.join(folderPath, file),
        ext: path.extname(file).toLowerCase(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    return { success: true, files: imageFiles };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * Read an image file as a base64 data URL
 * Uses async fs.readFile to avoid blocking the main process.
 */
ipcMain.handle('fs:readImageAsBase64', async (_event, filePath) => {
  try {
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.tiff': 'image/tiff',
      '.tif': 'image/tiff',
    };
    const mime = mimeMap[ext] || 'image/jpeg';
    const base64 = buffer.toString('base64');
    return { success: true, dataUrl: `data:${mime};base64,${base64}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * Save a cropped image (base64) to the output folder
 * Uses async fs.writeFile to avoid blocking the main process.
 */
ipcMain.handle('fs:saveCroppedImage', async (_event, { outputFolder, originalName, base64Data }) => {
  try {
    const parsed = path.parse(originalName);
    const newName = `${parsed.name}_passport.jpg`;
    const outputPath = path.join(outputFolder, newName);

    // Strip data URL prefix
    const rawBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(rawBase64, 'base64');
    await fs.writeFile(outputPath, buffer);

    return { success: true, outputPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

/**
 * Get the app's resource path (for locating local model/WASM files)
 */
ipcMain.handle('app:getResourcePath', async () => {
  const isDev = !app.isPackaged;
  if (isDev) {
    return path.join(__dirname, '../../public');
  }
  return process.resourcesPath;
});

/**
 * Show an alert / info dialog
 */
ipcMain.handle('dialog:showInfo', async (_event, { title, message }) => {
  await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title,
    message,
    buttons: ['OK'],
  });
});

/**
 * Show an error dialog
 */
ipcMain.handle('dialog:showError', async (_event, { title, message }) => {
  await dialog.showMessageBox(mainWindow, {
    type: 'error',
    title,
    message,
    buttons: ['OK'],
  });
});
