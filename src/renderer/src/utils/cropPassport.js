/**
 * Passport Photo Crop Utility — Indian Passport Standard
 *
 * Implements the passport photo cropping algorithm for Indian passport photos:
 * - Full head (crown to chin) occupies ~52% of total image height
 * - Strict 3.5:4.5 aspect ratio (413×531 pixels at 300 DPI)
 * - Face centered horizontally; ~15% margin above the crown
 * - Shoulders visible: ~33% of photo height below the chin
 *
 * Indian Passport Photo Requirements:
 *   - Size: 3.5cm × 4.5cm
 *   - Face (crown to chin) ≈ 50–55% of photo height (~25mm out of 45mm)
 *   - Top margin ≈ 15% (about 6.75mm above crown — generous for long hair)
 *   - Shoulder/chest area ≈ 33% of photo height below the chin
 *   - White or light-colored background
 *
 * MediaPipe BoundingBox is in PIXELS (not normalized):
 *   { originX, originY, width, height, angle }
 *
 * IMPORTANT: MediaPipe's face bounding box covers approximately from the
 * forehead/hairline down to the chin. It does NOT include the crown/top of
 * head or hair. We must expand upward generously to estimate the full head
 * height (crown/hair to chin) before computing the passport crop region.
 * The expansion is deliberately generous (40%) to accommodate people with
 * long, voluminous, or styled hair that extends well above the forehead.
 *
 * Proportional breakdown of a standard Indian passport photo:
 *   ┌──────────────────────┐ ← Top edge
 *   │     15% top margin   │ ← Space above crown/hair
 *   ├──────────────────────┤ ← Crown/top of hair
 *   │                      │
 *   │   52% full head      │ ← Crown/hair to chin (estimated)
 *   │  (face bbox + crown) │
 *   ├──────────────────────┤ ← Chin
 *   │                      │
 *   │   33% shoulders      │ ← Neck, shoulders, upper chest
 *   │                      │
 *   └──────────────────────┘ ← Bottom edge
 */

// Standard passport dimensions in pixels (300 DPI equivalent)
const PASSPORT_WIDTH = 413;  // 3.5 cm at 300 DPI
const PASSPORT_HEIGHT = 531; // 4.5 cm at 300 DPI
const ASPECT_RATIO = PASSPORT_WIDTH / PASSPORT_HEIGHT; // ~0.777

// ─── Proportion Constants (tuned for Indian passport standard) ───

// MediaPipe's face bbox covers forehead-to-chin. We expand upward by this
// factor to estimate the full head height (crown/hair to chin). The crown area
// (hair above the forehead) varies greatly: short hair ~20%, long/voluminous
// hair ~35–45%. We use 40% to safely accommodate all hair types including
// long, tied-up, or voluminous hair that extends well above the forehead.
const CROWN_EXPANSION = 0.40; // Add 40% of faceH above the face bbox for crown/hair

// Full head (crown/hair to chin) as a proportion of the final passport photo height.
// Standard Indian passport: the head should occupy 50–55% of the photo.
const HEAD_RATIO = 0.52;

// Top margin above the estimated crown/hair, as a proportion of crop height.
// Generous 15% to ensure long/voluminous hair is never cropped out.
// ICAO standard allows up to 15% top margin.
const TOP_MARGIN_RATIO = 0.15;

/**
 * Compute the passport crop rectangle from a MediaPipe face detection result.
 *
 * @param {Object} detection - A single MediaPipe FaceDetector Detection
 *   Shape: { boundingBox: { originX, originY, width, height }, categories, keypoints }
 *   BoundingBox values are in pixels relative to the source image.
 * @param {number} imgWidth - Source image width in pixels
 * @param {number} imgHeight - Source image height in pixels
 * @returns {{ sx: number, sy: number, sw: number, sh: number, outW: number, outH: number }}
 *   sx, sy, sw, sh: source crop rectangle (pixels)
 *   outW, outH: output image dimensions (pixels)
 */
export function computePassportCrop(detection, imgWidth, imgHeight) {
  const bbox = detection.boundingBox;
  if (!bbox) {
    throw new Error('Detection has no bounding box');
  }

  // Bounding box is already in pixels
  const faceX = bbox.originX;
  const faceY = bbox.originY;
  const faceW = bbox.width;
  const faceH = bbox.height;

  // ─── Step 1: Estimate full head height (crown to chin) ───
  // MediaPipe's bbox is forehead-to-chin. We extend upward to include the crown.
  const crownOffset = faceH * CROWN_EXPANSION;
  const headHeight = faceH + crownOffset; // Full head: crown to chin

  // ─── Step 2: Determine crop height ───
  // Indian passport standard: full head (crown/hair to chin) ≈ 52% of photo height.
  // This ensures ~33% of the photo below the chin for shoulders/chest.
  let cropHeight = headHeight / HEAD_RATIO;

  // ─── Step 3: Determine crop width from aspect ratio ───
  let cropWidth = cropHeight * ASPECT_RATIO;

  // ─── Step 4: Vertical positioning ───
  // Place the crop so that:
  //   - 15% of crop height is above the estimated crown/hair
  //   - The estimated crown sits right below that margin
  //   - The chin is at 15% + 52% = 67% from the top
  //   - Shoulders fill the bottom 33%
  const estimatedCrownY = faceY - crownOffset;
  const topMargin = cropHeight * TOP_MARGIN_RATIO;
  let cropY = estimatedCrownY - topMargin;

  // ─── Step 5: Horizontal centering ───
  // Center the face horizontally in the crop
  const faceCenterX = faceX + faceW / 2;
  let cropX = faceCenterX - cropWidth / 2;

  // ─── Step 6: Clamp to image boundaries ───
  // First try shifting (preserves crop dimensions)
  if (cropX < 0) cropX = 0;
  if (cropY < 0) cropY = 0;
  if (cropX + cropWidth > imgWidth) cropX = imgWidth - cropWidth;
  if (cropY + cropHeight > imgHeight) cropY = imgHeight - cropHeight;

  // Final safety: if crop still exceeds image after shifting, shrink proportionally
  if (cropX < 0 || cropY < 0 || cropWidth > imgWidth || cropHeight > imgHeight) {
    const scaleW = imgWidth / cropWidth;
    const scaleH = imgHeight / cropHeight;
    const scale = Math.min(scaleW, scaleH) * 0.98; // 2% padding
    cropWidth = Math.floor(cropWidth * scale);
    cropHeight = Math.floor(cropHeight * scale);
    cropX = Math.max(0, Math.floor(faceCenterX - cropWidth / 2));
    cropY = Math.max(0, Math.floor(estimatedCrownY - cropHeight * TOP_MARGIN_RATIO));
  }

  // Ensure integer pixel values and minimum dimensions
  cropX = Math.max(0, Math.floor(cropX));
  cropY = Math.max(0, Math.floor(cropY));
  cropWidth = Math.max(1, Math.floor(cropWidth));
  cropHeight = Math.max(1, Math.floor(cropHeight));

  return {
    sx: cropX,
    sy: cropY,
    sw: cropWidth,
    sh: cropHeight,
    outW: PASSPORT_WIDTH,
    outH: PASSPORT_HEIGHT,
  };
}

/**
 * Crop an image from a data URL and produce the passport-sized output.
 * Uses HTML5 Canvas for pixel-level cropping with high-quality downscaling.
 *
 * Memory management: The temporary canvas pixel buffer is explicitly released
 * after the JPEG export to prevent memory accumulation during bulk processing.
 *
 * @param {string} dataUrl - Source image as data URL
 * @param {Object} cropRect - { sx, sy, sw, sh, outW, outH }
 * @returns {Promise<string>} - Cropped image as JPEG data URL (0.95 quality)
 */
export function applyCrop(dataUrl, cropRect) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { sx, sy, sw, sh, outW, outH } = cropRect;

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw the cropped region from source, scaled to passport dimensions
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      // Export as high-quality JPEG (0.95 quality ≈ 300 DPI equivalent)
      const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);

      // Release canvas pixel buffer immediately after export
      canvas.width = 0;
      canvas.height = 0;

      resolve(jpegDataUrl);
    };
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}
