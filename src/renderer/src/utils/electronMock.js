/**
 * Electron API Mock for Browser Preview
 *
 * When running outside Electron (plain browser), this module provides
 * mock implementations of the Electron IPC APIs so the UI can be previewed.
 *
 * In demo mode, it generates synthetic face images and simulates
 * face detection + passport cropping.
 */

// Sample face image data URLs (generated via canvas)
const DEMO_IMAGES = [];

/**
 * Generate a synthetic "portrait" image using canvas drawing.
 * Creates a simple avatar-like face on a blue/gray background.
 */
function generatePortraitImage(seed) {
  const canvas = document.createElement('canvas');
  const size = 600 + (seed * 50); // Vary sizes
  canvas.width = size;
  canvas.height = size + 200;
  const ctx = canvas.getContext('2d');

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, '#e2e8f0');
  bgGrad.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Body/shoulders
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, canvas.height * 0.85, canvas.width * 0.35, canvas.height * 0.25, 0, Math.PI, 0);
  ctx.fill();

  // Neck
  ctx.fillStyle = '#fcd34d';
  ctx.fillRect(canvas.width / 2 - 30, canvas.height * 0.55, 60, canvas.height * 0.15);

  // Head
  const headCenterX = canvas.width / 2;
  const headCenterY = canvas.height * 0.38;
  const headRadiusX = canvas.width * 0.18;
  const headRadiusY = canvas.height * 0.18;

  ctx.fillStyle = '#fcd34d';
  ctx.beginPath();
  ctx.ellipse(headCenterX, headCenterY, headRadiusX, headRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  const hairHues = ['#1e293b', '#78350f', '#7c2d12', '#3f3f46'];
  ctx.fillStyle = hairHues[seed % hairHues.length];
  ctx.beginPath();
  ctx.ellipse(headCenterX, headCenterY - headRadiusY * 0.35, headRadiusX * 1.1, headRadiusY * 0.75, 0, Math.PI, 0);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(headCenterX - headRadiusX * 0.35, headCenterY - headRadiusY * 0.1, 5, 0, Math.PI * 2);
  ctx.arc(headCenterX + headRadiusX * 0.35, headCenterY - headRadiusY * 0.1, 5, 0, Math.PI * 2);
  ctx.fill();

  // Mouth
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(headCenterX, headCenterY + headRadiusY * 0.35, 12, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  // Nose
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(headCenterX, headCenterY - headRadiusY * 0.05);
  ctx.lineTo(headCenterX - 5, headCenterY + headRadiusY * 0.15);
  ctx.lineTo(headCenterX + 5, headCenterY + headRadiusY * 0.15);
  ctx.stroke();

  return canvas.toDataURL('image/jpeg', 0.9);
}

// Pre-generate demo images
function initDemoImages() {
  if (DEMO_IMAGES.length > 0) return;
  for (let i = 0; i < 8; i++) {
    DEMO_IMAGES.push({
      name: `portrait_${String(i + 1).padStart(3, '0')}.jpg`,
      fullPath: `/demo/portrait_${String(i + 1).padStart(3, '0')}.jpg`,
      ext: '.jpg',
      dataUrl: generatePortraitImage(i),
    });
  }
}

/**
 * Check if we're running inside Electron or in a plain browser.
 */
export function isElectron() {
  return !!(window && window.electronAPI && window.electronAPI.isElectron === true);
}

/**
 * Install the mock electronAPI on window if not running in Electron.
 */
export function installElectronMock() {
  if (isElectron()) return;

  console.log('[Mock] Running in browser mode — installing Electron API mocks');

  initDemoImages();

  window.electronAPI = {
    selectInputFolder: async () => {
      // Simulate a folder selection — return a fake path
      return '/demo/input-folder';
    },

    selectOutputFolder: async () => {
      return '/demo/output-folder';
    },

    listImages: async (folderPath) => {
      // Return the demo images
      return {
        success: true,
        files: DEMO_IMAGES.map((img) => ({
          name: img.name,
          fullPath: img.fullPath,
          ext: img.ext,
        })),
      };
    },

    readImageAsBase64: async (filePath) => {
      const img = DEMO_IMAGES.find((i) => i.fullPath === filePath);
      if (img) {
        return { success: true, dataUrl: img.dataUrl };
      }
      return { success: false, error: 'File not found in demo mode' };
    },

    saveCroppedImage: async (outputFolder, originalName, base64Data) => {
      // In browser preview, just pretend we saved it
      console.log(`[Mock] Saved: ${outputFolder}/${originalName.replace(/\.\w+$/, '_passport.jpg')}`);
      return { success: true, outputPath: `${outputFolder}/${originalName.replace(/\.\w+$/, '_passport.jpg')}` };
    },

    getResourcePath: async () => {
      // In browser mode, return a path that indicates dev mode
      return '/public';
    },

    showInfo: async (title, message) => {
      alert(`${title}\n\n${message}`);
    },

    showError: async (title, message) => {
      alert(`Error: ${title}\n\n${message}`);
    },

    // getPathForFile is Electron-only (webUtils.getPathForFile)
    // Not available in browser mode; drag-and-drop uses FileReader instead
    getPathForFile: null,

    // Flag: false in browser mock mode
    isElectron: false,
  };
}
