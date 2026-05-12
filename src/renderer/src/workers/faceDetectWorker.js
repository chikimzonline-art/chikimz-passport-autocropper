/**
 * Web Worker for MediaPipe Face Detection
 *
 * ⚠️ DEPRECATED / UNUSED — This worker is NOT currently used by the app.
 * Face detection now runs on the main thread via faceDetector.js with:
 *   - blaze_face_full_range model (instead of short_range)
 *   - minDetectionConfidence: 0.3 (instead of 0.5)
 *   - Multi-strategy fallback (upper-crop + zoom)
 *
 * This file is kept for reference only. If Web Worker support is needed
 * in the future (e.g. for Electron compatibility improvements), this
 * worker would need to be updated to match faceDetector.js settings
 * and handle the multi-strategy detection logic.
 *
 * Known issues with this worker:
 *   - Uses outdated blaze_face_short_range model (missing distant faces)
 *   - Uses minDetectionConfidence: 0.5 (too high for passport photos)
 *   - No multi-strategy fallback for small/distant faces
 *   - Image elements created inside detectFaces() are not cleaned up (memory leak)
 *   - MediaPipe WASM may not work correctly in Web Worker context within Electron
 */

let faceDetector = null;
let isInitialized = false;

/**
 * Dynamically import the MediaPipe tasks-vision library.
 * In a Web Worker context, we need to use importScripts or dynamic import.
 */
async function loadMediaPipe() {
  // For Vite-bundled workers, dynamic import works
  const visionModule = await import('@mediapipe/tasks-vision');
  return visionModule;
}

/**
 * Initialize the MediaPipe FaceDetector with local WASM and model files.
 * @param {string} wasmPath - URL/path to the WASM directory
 * @param {string} modelPath - URL/path to the model file
 */
async function initialize({ wasmPath, modelPath }) {
  if (isInitialized) return;

  try {
    console.log('[Worker] Initializing MediaPipe FaceDetector...');
    console.log('[Worker] WASM path:', wasmPath);
    console.log('[Worker] Model path:', modelPath);

    const { FilesetResolver, FaceDetector } = await loadMediaPipe();

    // Resolve local WASM files — critical for offline operation
    const vision = await FilesetResolver.forVisionTasks(wasmPath);

    // Try GPU first, fall back to CPU
    try {
      faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'GPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      });
      console.log('[Worker] FaceDetector initialized with GPU delegate');
    } catch (gpuErr) {
      console.warn('[Worker] GPU delegate failed, falling back to CPU:', gpuErr.message);
      faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      });
      console.log('[Worker] FaceDetector initialized with CPU delegate');
    }

    isInitialized = true;
    self.postMessage({ type: 'initialized', success: true });
  } catch (err) {
    console.error('[Worker] Initialization failed:', err);
    self.postMessage({ type: 'initialized', success: false, error: err.message });
  }
}

/**
 * Detect faces in an image.
 * @param {string} imageDataUrl - The image as a data URL
 * @param {string} imageId - Identifier for the image (filename)
 */
async function detectFaces(imageDataUrl, imageId) {
  if (!isInitialized || !faceDetector) {
    self.postMessage({
      type: 'detection-result',
      imageId,
      success: false,
      error: 'FaceDetector not initialized',
    });
    return;
  }

  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageDataUrl;
    });

    const result = faceDetector.detect(img);

    self.postMessage({
      type: 'detection-result',
      imageId,
      success: true,
      detections: result.detections || [],
      imageWidth: img.naturalWidth,
      imageHeight: img.naturalHeight,
    });
  } catch (err) {
    self.postMessage({
      type: 'detection-result',
      imageId,
      success: false,
      error: err.message,
    });
  }
}

// ─── Message Handler ───
self.onmessage = async (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'init':
      await initialize(payload);
      break;

    case 'detect':
      await detectFaces(payload.imageDataUrl, payload.imageId);
      break;

    case 'shutdown':
      if (faceDetector) {
        faceDetector.close();
        faceDetector = null;
        isInitialized = false;
      }
      self.postMessage({ type: 'shutdown-complete' });
      break;

    default:
      console.warn('[Worker] Unknown message type:', type);
  }
};
