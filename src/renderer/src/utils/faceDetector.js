/**
 * Face Detection Module (Main Thread) — Enhanced for Full-Range Detection
 *
 * Initializes MediaPipe FaceDetector using the blaze_face_full_range model,
 * which detects faces at ALL distances (small/distant faces AND large/close faces).
 *
 * Detection strategy:
 *   1. Primary: Detect on full image with full_range model (minConfidence=0.3)
 *   2. Fallback: If no face found, crop to upper 60% of image (face is always
 *      in upper portion for passport-style photos) and retry detection
 *   3. Multi-scale: If still no face, retry at 1.5x and 2x zoom on upper crop
 *
 * Uses async yielding (setTimeout between images) to keep UI responsive.
 *
 * WASM and model files are served from public/ directory (Vite dev server)
 * or from resources/ (packaged Electron app).
 *
 * Fallback: If MediaPipe fails to load (e.g. browser preview without WASM),
 * a mock detector generates plausible bounding boxes from image dimensions.
 */

import { FilesetResolver, FaceDetector } from '@mediapipe/tasks-vision';
import { isElectron } from './electronMock';

let faceDetector = null;
let isInitialized = false;
let useMockDetector = false;

// Minimum detection confidence — lowered from 0.5 to 0.3 to catch
// faces the model is less certain about. Acceptable for passport photos
// where we expect exactly one face per image.
const MIN_DETECTION_CONFIDENCE = 0.3;

/**
 * Initialize the FaceDetector with the full_range model.
 *
 * @param {string|null} resourcePath - From Electron's getResourcePath, or null for dev mode
 * @returns {Promise<boolean>}
 */
export async function initializeFaceDetector(resourcePath = null) {
  if (isInitialized && faceDetector) return true;

  try {
    // const isDev = !resourcePath || resourcePath.includes('/public');
    const isDev = !resourcePath || resourcePath.includes('/public') || resourcePath.includes('\\public');

    const wasmPath = isDev ? './wasm' : `file://${resourcePath}/wasm`;
    // Use full_range model — detects small/distant AND large/close faces
    const modelPath = isDev
      ? './models/blaze_face_full_range.tflite'
      : `file://${resourcePath}/models/blaze_face_full_range.tflite`;

    console.log('[FaceDetector] Initializing with FULL RANGE model...');
    console.log('[FaceDetector] WASM path:', wasmPath);
    console.log('[FaceDetector] Model path:', modelPath);

    const vision = await FilesetResolver.forVisionTasks(wasmPath);

    // Try GPU delegate first, fall back to CPU
    try {
      faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'GPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: MIN_DETECTION_CONFIDENCE,
      });
      console.log('[FaceDetector] Initialized with GPU delegate (full_range model)');
    } catch (gpuErr) {
      console.warn('[FaceDetector] GPU delegate failed, falling back to CPU:', gpuErr.message);
      faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: MIN_DETECTION_CONFIDENCE,
      });
      console.log('[FaceDetector] Initialized with CPU delegate (full_range model)');
    }

    isInitialized = true;
    useMockDetector = false;
    return true;
  } catch (err) {
    console.error('[FaceDetector] MediaPipe init failed:', err.message);
    console.log('[FaceDetector] Falling back to mock detector for preview mode');

    useMockDetector = true;
    isInitialized = true;
    return true;
  }
}

/**
 * Generate a mock face detection bounding box for an image.
 * Places a plausible face region in the upper-center portion of the image.
 */
function mockDetect(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  // Face is roughly in the upper-center 40% of the image
  const faceW = w * 0.4;
  const faceH = h * 0.35;
  const faceX = (w - faceW) / 2;
  const faceY = h * 0.1;

  return [
    {
      boundingBox: {
        originX: faceX,
        originY: faceY,
        width: faceW,
        height: faceH,
        angle: 0,
      },
      categories: [{ score: 0.95, index: 0, categoryName: 'face', displayName: 'Face' }],
      keypoints: [],
    },
  ];
}

/**
 * Detect faces on a canvas using the MediaPipe detector.
 * @param {HTMLCanvasElement} canvas
 * @returns {Array} detections
 */
function detectOnCanvas(canvas) {
  if (!faceDetector) return [];
  const result = faceDetector.detect(canvas);
  return result.detections || [];
}

/**
 * Create a canvas from an image element, optionally cropping a region.
 * @param {HTMLImageElement} img
 * @param {number} sx - Source x (0 = full width from left)
 * @param {number} sy - Source y
 * @param {number} sw - Source width (0 = full width)
 * @param {number} sh - Source height (0 = full height)
 * @returns {HTMLCanvasElement}
 */
function imageToCanvas(img, sx = 0, sy = 0, sw = 0, sh = 0) {
  const w = sw || img.naturalWidth || img.width;
  const h = sh || img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
  return canvas;
}

/**
 * Scale a canvas by a given factor for multi-scale detection.
 * @param {HTMLCanvasElement} srcCanvas
 * @param {number} scale
 * @returns {HTMLCanvasElement}
 */
function scaleCanvas(srcCanvas, scale) {
  const newW = Math.round(srcCanvas.width * scale);
  const newH = Math.round(srcCanvas.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = newW;
  canvas.height = newH;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(srcCanvas, 0, 0, newW, newH);
  return canvas;
}

/**
 * Map a detection from a cropped/scaled canvas back to original image coordinates.
 * @param {Object} detection - MediaPipe detection result
 * @param {number} offsetX - X offset of the crop in original image
 * @param {number} offsetY - Y offset of the crop in original image
 * @param {number} scaleX - Scale factor (original / detection canvas)
 * @param {number} scaleY - Scale factor (original / detection canvas)
 * @returns {Object} detection with remapped bounding box
 */
function remapDetection(detection, offsetX, offsetY, scaleX, scaleY) {
  if (!detection.boundingBox) return detection;

  const bbox = detection.boundingBox;
  return {
    ...detection,
    boundingBox: {
      ...bbox,
      originX: bbox.originX * scaleX + offsetX,
      originY: bbox.originY * scaleY + offsetY,
      width: bbox.width * scaleX,
      height: bbox.height * scaleY,
    },
    keypoints: (detection.keypoints || []).map((kp) => ({
      ...kp,
      x: kp.x * scaleX + offsetX,
      y: kp.y * scaleY + offsetY,
    })),
  };
}

/**
 * Release a canvas element's GPU and pixel memory immediately.
 * This prevents temporary canvases from holding large image buffers
 * during bulk processing, which would otherwise wait for garbage collection.
 * @param {HTMLCanvasElement|null} canvas
 */
function releaseCanvas(canvas) {
  if (!canvas) return;
  // Zero out dimensions to release the backing pixel buffer immediately
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * Detect faces in an image with enhanced multi-strategy approach.
 *
 * Strategy:
 *   1. Detect on full image (full_range model catches most faces)
 *   2. If no face, crop to upper 60% and retry (for full-body shots where face is small)
 *   3. If still no face, try 1.5x and 2x zoom on the upper crop
 *
 * All temporary canvases are explicitly released after use to prevent
 * memory accumulation during bulk processing of large images.
 *
 * @param {HTMLImageElement} img - The loaded image element
 * @returns {Array} - Array of MediaPipe detection results (coordinates in original image space)
 */
export function detectFaces(img) {
  if (!isInitialized) {
    throw new Error('FaceDetector not initialized');
  }

  if (useMockDetector) {
    return mockDetect(img);
  }

  if (!faceDetector) {
    throw new Error('FaceDetector not initialized');
  }

  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;

  // ─── Strategy 1: Detect on full image ───
  const fullCanvas = imageToCanvas(img);
  let detections = detectOnCanvas(fullCanvas);

  if (detections.length > 0) {
    console.log(`[FaceDetector] Found ${detections.length} face(s) on full image`);
    releaseCanvas(fullCanvas);
    return detections;
  }

  // Release full canvas — no longer needed
  releaseCanvas(fullCanvas);

  console.log('[FaceDetector] No face on full image, trying upper-crop strategy...');

  // ─── Strategy 2: Crop to upper 60% of image and retry ───
  // In passport-style photos, the face is ALWAYS in the upper portion.
  // Cropping the bottom 40% makes the face occupy a larger % of the detection input.
  const upperCropH = Math.round(imgH * 0.6);
  const upperCanvas = imageToCanvas(img, 0, 0, imgW, upperCropH);
  detections = detectOnCanvas(upperCanvas);

  if (detections.length > 0) {
    // Remap coordinates back to original image space
    console.log(`[FaceDetector] Found ${detections.length} face(s) in upper crop`);
    releaseCanvas(upperCanvas);
    return detections.map((d) => remapDetection(d, 0, 0, 1, 1));
  }

  // ─── Strategy 3: Multi-scale detection on upper crop ───
  // Try 1.5x and 2x zoom — this helps when the face is very small (far from camera)
  const scales = [1.5, 2.0];
  let result = null;

  for (const scale of scales) {
    console.log(`[FaceDetector] Trying ${scale}x zoom on upper crop...`);
    const scaledCanvas = scaleCanvas(upperCanvas, scale);
    detections = detectOnCanvas(scaledCanvas);

    // Release scaled canvas immediately after detection
    releaseCanvas(scaledCanvas);

    if (detections.length > 0) {
      // Remap: first undo the scale, coordinates are already in upper-crop space
      console.log(`[FaceDetector] Found ${detections.length} face(s) at ${scale}x zoom`);
      result = detections.map((d) => remapDetection(d, 0, 0, 1 / scale, 1 / scale));
      break;
    }
  }

  // Release upper crop canvas — no longer needed
  releaseCanvas(upperCanvas);

  if (result) {
    return result;
  }

  // ─── All strategies failed ───
  console.log('[FaceDetector] No face detected after all strategies');
  return [];
}

/**
 * Check if the detector is ready.
 */
export function isReady() {
  return isInitialized && (faceDetector !== null || useMockDetector);
}

/**
 * Check if using mock detector (for UI indicators).
 */
export function isMockMode() {
  return useMockDetector;
}

/**
 * Shut down the detector and free resources.
 */
export function shutdownFaceDetector() {
  if (faceDetector) {
    faceDetector.close();
    faceDetector = null;
  }
  isInitialized = false;
  useMockDetector = false;
}
