import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';
import { isElectron } from './electronMock';

let segmenter = null;
let isInitialized = false;

export async function initializeBackgroundRemover(resourcePath = null) {
  if (isInitialized && segmenter) return true;

  try {
    const isDev = !resourcePath || resourcePath.includes('/public') || resourcePath.includes('\\public');

    const wasmPath = isDev ? './wasm' : `file://${resourcePath}/wasm`;
    const modelPath = isDev
      ? './models/selfie_segmenter.tflite'
      : `file://${resourcePath}/models/selfie_segmenter.tflite`;

    console.log('[BackgroundRemover] Initializing selfie segmentation model...');
    console.log('[BackgroundRemover] WASM path:', wasmPath);
    console.log('[BackgroundRemover] Model path:', modelPath);

    const vision = await FilesetResolver.forVisionTasks(wasmPath);

    const segmenterOptions = {
      baseOptions: { modelAssetPath: modelPath },
      runningMode: 'IMAGE',
      outputCategoryMask: true,
      outputConfidenceMasks: true,
    };

    try {
      segmenter = await ImageSegmenter.createFromOptions(vision, {
        ...segmenterOptions,
        baseOptions: { ...segmenterOptions.baseOptions, delegate: 'GPU' },
      });
      console.log('[BackgroundRemover] Initialized with GPU delegate');
    } catch (gpuErr) {
      console.warn('[BackgroundRemover] GPU delegate failed, falling back to CPU:', gpuErr.message);
      segmenter = await ImageSegmenter.createFromOptions(vision, {
        ...segmenterOptions,
        baseOptions: { ...segmenterOptions.baseOptions, delegate: 'CPU' },
      });
      console.log('[BackgroundRemover] Initialized with CPU delegate');
    }

    isInitialized = true;
    return true;
  } catch (err) {
    console.error('[BackgroundRemover] Initialization failed:', err.message);
    console.log('[BackgroundRemover] Background removal will be unavailable');
    isInitialized = false;
    return false;
  }
}

export function removeBackground(img, bgColor = '#ffffff') {
  if (!isInitialized || !segmenter) {
    throw new Error('BackgroundRemover not initialized');
  }

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  const inputCanvas = document.createElement('canvas');
  inputCanvas.width = w;
  inputCanvas.height = h;
  const inputCtx = inputCanvas.getContext('2d');
  inputCtx.drawImage(img, 0, 0);

  const result = segmenter.segment(inputCanvas);

  inputCanvas.width = 0;
  inputCanvas.height = 0;

  const confidenceMasks = result.confidenceMasks;
  const categoryMask = result.categoryMask;

  let maskW, maskH, useConfidenceMask;
  let maskDataFloat, maskDataUint8;

  if (confidenceMasks && confidenceMasks.length > 0) {
    const personMask = confidenceMasks[0];
    maskDataFloat = personMask.getAsFloat32Array();
    maskW = personMask.width;
    maskH = personMask.height;
    useConfidenceMask = true;
    console.log('[BackgroundRemover] Using confidence masks (soft edges)');
  } else if (categoryMask) {
    maskDataUint8 = categoryMask.getAsUint8Array();
    maskW = categoryMask.width;
    maskH = categoryMask.height;
    useConfidenceMask = false;
    console.log('[BackgroundRemover] Using category mask (hard edges)');
  } else {
    throw new Error('Segmentation did not produce any mask');
  }

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = w;
  outputCanvas.height = h;
  const outputCtx = outputCanvas.getContext('2d');
  outputCtx.fillStyle = bgColor;
  outputCtx.fillRect(0, 0, w, h);

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(img, 0, 0);

  const imageData = tempCtx.getImageData(0, 0, w, h);
  const pixels = imageData.data;

  const scaleX = maskW / w;
  const scaleY = maskH / h;

  if (useConfidenceMask) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const maskX = Math.min(Math.floor(x * scaleX), maskW - 1);
        const maskY = Math.min(Math.floor(y * scaleY), maskH - 1);
        const confidence = maskDataFloat[maskY * maskW + maskX];
        const pixelIdx = (y * w + x) * 4;
        pixels[pixelIdx + 3] = Math.round(confidence * 255);
      }
    }
  } else {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const maskX = Math.min(Math.floor(x * scaleX), maskW - 1);
        const maskY = Math.min(Math.floor(y * scaleY), maskH - 1);
        const category = maskDataUint8[maskY * maskW + maskX];
        const pixelIdx = (y * w + x) * 4;
        if (category !== 0) {
          pixels[pixelIdx + 3] = 0;
        }
      }
    }
  }

  tempCtx.putImageData(imageData, 0, 0);
  outputCtx.drawImage(tempCanvas, 0, 0);

  if (confidenceMasks) {
    for (let i = 0; i < confidenceMasks.length; i++) {
      confidenceMasks[i].close();
    }
  }
  if (categoryMask) {
    categoryMask.close();
  }

  tempCanvas.width = 0;
  tempCanvas.height = 0;

  const outputDataUrl = outputCanvas.toDataURL('image/jpeg', 0.95);

  outputCanvas.width = 0;
  outputCanvas.height = 0;

  return outputDataUrl;
}

export function isBgRemoverReady() {
  return isInitialized && segmenter !== null;
}

export function shutdownBackgroundRemover() {
  if (segmenter) {
    segmenter.close();
    segmenter = null;
  }
  isInitialized = false;
}