import React, { useEffect, useState, useCallback } from 'react';
import { useProcessing } from '../hooks/useProcessing';
import FolderSelector from './FolderSelector';
import DropZone from './DropZone';
import ProgressBar from './ProgressBar';
import PreviewGrid from './PreviewGrid';
import { initializeFaceDetector, detectFaces, shutdownFaceDetector, isMockMode } from '../utils/faceDetector';
import { initializeBackgroundRemover, removeBackground, shutdownBackgroundRemover, isBgRemoverReady } from '../utils/backgroundRemover';
import { isElectron } from '../utils/electronMock';
import { computePassportCrop, applyCrop, straightenImage } from '../utils/cropPassport';

const dashboardStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
  padding: '20px 24px',
  gap: 16,
};

const headerTitleStyle = {
  fontSize: 22,
  fontWeight: 700,
  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  letterSpacing: '-0.5px',
};

const headerSubtitleStyle = {
  fontSize: 13,
  color: '#64748b',
  marginTop: 2,
};

const controlsRowStyle = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
};

const btnBase = {
  padding: '10px 24px',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const btnStart = {
  ...btnBase,
  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
  color: '#fff',
  boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)',
};

const btnStartDisabled = {
  ...btnBase,
  background: '#334155',
  color: '#64748b',
  cursor: 'not-allowed',
  boxShadow: 'none',
};

const btnCancel = {
  ...btnBase,
  background: 'rgba(239, 68, 68, 0.15)',
  color: '#ef4444',
  border: '1px solid rgba(239, 68, 68, 0.3)',
};

const btnReset = {
  ...btnBase,
  background: 'rgba(59, 130, 246, 0.1)',
  color: '#3b82f6',
  border: '1px solid rgba(59, 130, 246, 0.3)',
};

const statsRowStyle = {
  display: 'flex',
  gap: 12,
};

const statCardStyle = {
  flex: 1,
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 10,
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const statLabelStyle = {
  fontSize: 11,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  fontWeight: 600,
};

const statValueStyle = {
  fontSize: 20,
  fontWeight: 700,
  color: '#f1f5f9',
};

const separatorStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  color: '#475569',
  fontSize: 12,
  fontWeight: 500,
};

const separatorLineStyle = {
  flex: 1,
  height: 1,
  background: '#334155',
};

// ─── Background Removal Styles ───

const bgRemovalCardStyle = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 10,
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const bgRemovalHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const toggleTrackStyle = (active) => ({
  width: 44,
  height: 24,
  borderRadius: 12,
  background: active ? '#3b82f6' : '#475569',
  cursor: 'pointer',
  transition: 'background 0.2s ease',
  position: 'relative',
  flexShrink: 0,
});

const toggleThumbStyle = (active) => ({
  width: 20,
  height: 20,
  borderRadius: '50%',
  background: '#fff',
  position: 'absolute',
  top: 2,
  left: active ? 22 : 2,
  transition: 'left 0.2s ease',
  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
});

const colorSwatchRowStyle = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
};

const colorSwatchStyle = (active, color) => ({
  width: 28,
  height: 28,
  borderRadius: 6,
  background: color,
  border: active ? '2px solid #3b82f6' : '2px solid #475569',
  cursor: 'pointer',
  transition: 'border-color 0.2s ease, transform 0.15s ease',
  boxShadow: active ? '0 0 8px rgba(59,130,246,0.4)' : 'none',
});

const customColorInputStyle = {
  width: 28,
  height: 28,
  borderRadius: 6,
  border: '2px solid #475569',
  cursor: 'pointer',
  padding: 0,
  background: 'transparent',
};

// Common passport background colors
const PASSPORT_BG_COLORS = [
  { color: '#ffffff', label: 'White' },
  { color: '#e8e8e8', label: 'Light Gray' },
  { color: '#d6e4f0', label: 'Light Blue' },
  { color: '#f0f0f0', label: 'Off-White' },
  { color: '#e0e0e0', label: 'Gray' },
];

/**
 * Utility: Yield back to the event loop so UI stays responsive.
 */
const yieldToUI = () => new Promise((resolve) => setTimeout(resolve, 10));

/**
 * Utility: Load an HTMLImageElement from a data URL.
 */
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Utility: Calculate head tilt angle from face detection keypoints.
 * Uses the left eye and right eye positions to determine rotation angle.
 * Returns angle in degrees (positive = head tilted right, negative = tilted left).
 */
function getTiltAngle(detection) {
  const keypoints = detection.keypoints;
  if (!keypoints || keypoints.length < 2) return 0;

  // MediaPipe face keypoints: [0]=right eye, [1]=left eye, [2]=nose, [3]=mouth, [4]=right ear, [5]=left ear
  const rightEye = keypoints[0];
  const leftEye = keypoints[1];

  if (!rightEye || !leftEye) return 0;

  const dx = leftEye.x - rightEye.x;
  const dy = leftEye.y - rightEye.y;

  if (Math.abs(dx) < 1) return 0; // Eyes nearly vertical — skip

  // atan2 gives angle of the eye line from horizontal
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

export default function Dashboard() {
  const {
    state,
    setWorkerReady,
    addPreviewPair,
    addResult,
    setError,
    cancelProcessing,
    resetProcessing,
    setProgress,
    setCurrentFile,
    setStatus,
    cancelledRef,
  } = useProcessing();

  const [isInitializing, setIsInitializing] = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const [browserMode, setBrowserMode] = useState(false);
  const [removeBg, setRemoveBg] = useState(false);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [bgRemoverReady, setBgRemoverReady] = useState(false);

  useEffect(() => {
    setBrowserMode(!isElectron());
  }, []);

  // ─── Initialize FaceDetector & BackgroundRemover on mount ───
  useEffect(() => {
    let mounted = true;

    async function init() {
      if (isInitializing) return;
      setIsInitializing(true);

      try {
        const resourcePath = await window.electronAPI.getResourcePath();
        await initializeFaceDetector(resourcePath);

        if (mounted) {
          setWorkerReady(true);
          setMockMode(isMockMode());
        }

        // Initialize background remover (non-blocking — failure just disables the feature)
        try {
          const bgOk = await initializeBackgroundRemover(resourcePath);
          if (mounted && bgOk) {
            setBgRemoverReady(true);
          }
        } catch (bgErr) {
          console.warn('[Dashboard] Background remover init failed:', bgErr.message);
        }
      } catch (err) {
        if (mounted) {
          setError(`FaceDetector failed: ${err.message}`);
        }
      } finally {
        if (mounted) {
          setIsInitializing(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      shutdownFaceDetector();
      shutdownBackgroundRemover();
    };
  }, []);

  // ─── Determine source mode ───
  const isDropMode = state.imageFiles.length > 0 && state.imageFiles[0]?.source === 'drop';

  // ─── Start Bulk Processing ───
  const startProcessing = useCallback(async () => {
    const { outputFolder, imageFiles, droppedFiles } = state;
    if (!imageFiles.length) return;

    // For folder mode, both input and output folders are required
    // For drop mode, only output folder is required
    if (!isDropMode && !state.inputFolder) return;
    if (!outputFolder) return;

    cancelledRef.current = false;
    setStatus('processing');
    setProgress(0, imageFiles.length);

    const total = imageFiles.length;

    for (let i = 0; i < total; i++) {
      // ─── Cancellation check ───
      if (cancelledRef.current) {
        setStatus('cancelled');
        return;
      }

      const file = imageFiles[i];
      setCurrentFile(file.name);
      setProgress(i + 1, total);

      try {
        let imageDataUrl;

        // ─── Step 1: Get image data ───
        if (file.source === 'drop' && droppedFiles) {
          // Drop mode with in-memory data (browser mode)
          const droppedEntry = droppedFiles.find((d) => d.name === file.name);
          if (droppedEntry) {
            imageDataUrl = droppedEntry.dataUrl;
          }
        }

        if (!imageDataUrl && file.source === 'drop' && isElectron()) {
          // Drop mode in Electron — read via IPC using file path
          const readResult = await window.electronAPI.readImageAsBase64(file.fullPath);
          if (!readResult.success) {
            addResult({ name: file.name, status: 'error', error: readResult.error });
            await yieldToUI();
            continue;
          }
          imageDataUrl = readResult.dataUrl;
        }

        if (!imageDataUrl && !file.source) {
          // Folder mode — read via IPC
          const readResult = await window.electronAPI.readImageAsBase64(file.fullPath);
          if (!readResult.success) {
            addResult({ name: file.name, status: 'error', error: readResult.error });
            await yieldToUI();
            continue;
          }
          imageDataUrl = readResult.dataUrl;
        }

        if (!imageDataUrl) {
          addResult({ name: file.name, status: 'error', error: 'Could not read image data' });
          await yieldToUI();
          continue;
        }

        // Step 2: Load into HTMLImageElement
        const img = await loadImage(imageDataUrl);

        // Step 3: Detect face(s)
        let detections = detectFaces(img);

        if (!detections || detections.length === 0) {
          // Release Image element memory when no face detected
          img.src = '';
          addResult({ name: file.name, status: 'error', error: 'No face detected' });
          await yieldToUI();
          continue;
        }

        // Step 3b: Straighten image if face is tilted (using eye keypoints)
        let straightenedDataUrl = imageDataUrl;
        let straightenedImg = img;
        const bestDetection = detections[0];
        const tiltAngle = getTiltAngle(bestDetection);

        if (Math.abs(tiltAngle) > 2) {
          // Tilt > 2° — straighten the image
          straightenedDataUrl = straightenImage(img, tiltAngle, bgColor);
          img.src = ''; // Release original image

          // Re-detect face on the straightened image for accurate crop rectangle
          straightenedImg = await loadImage(straightenedDataUrl);
          detections = detectFaces(straightenedImg);

          if (!detections || detections.length === 0) {
            // If re-detection fails, fall back to original detection
            // (adjust coordinates for the rotated image)
            straightenedImg.src = '';
            addResult({ name: file.name, status: 'error', error: 'Face lost after straightening' });
            await yieldToUI();
            continue;
          }
        }

        // Step 4: Compute passport crop rectangle (on the straightened image)
        const finalDetection = detections[0];
        const cropRect = computePassportCrop(finalDetection, straightenedImg.naturalWidth, straightenedImg.naturalHeight);

        // Release Image element — no longer needed after crop rect computed
        straightenedImg.src = '';

        // Step 5: Apply the crop first (produces passport-sized JPEG)
        let croppedDataUrl = await applyCrop(straightenedDataUrl, cropRect);

        // Release straightened data URL if different from original
        if (straightenedDataUrl !== imageDataUrl) {
          straightenedDataUrl = null;
        }

        // Step 5b: Remove background if enabled (after cropping — better segmentation on larger face)
        if (removeBg && bgRemoverReady) {
          try {
            const croppedImg = await loadImage(croppedDataUrl);
            const bgRemovedDataUrl = removeBackground(croppedImg, bgColor);
            croppedImg.src = '';
            croppedDataUrl = bgRemovedDataUrl;
          } catch (bgErr) {
            console.warn(`[Dashboard] BG removal failed for ${file.name}:`, bgErr.message);
            // Continue with cropped image (no bg removal)
          }
        }

        // Step 6: Save to output folder
        const saveResult = await window.electronAPI.saveCroppedImage(
          outputFolder,
          file.name,
          croppedDataUrl
        );

        if (!saveResult.success) {
          addResult({ name: file.name, status: 'error', error: saveResult.error });
          await yieldToUI();
          continue;
        }

        addResult({ name: file.name, status: 'success' });
        addPreviewPair({
          original: imageDataUrl,
          cropped: croppedDataUrl,
          name: file.name,
        });

        // Release large data URL references to allow GC before next iteration.
        // Without this, the current and previous iteration's data URLs remain
        // in scope until the next GC sweep, doubling peak memory usage.
        imageDataUrl = null;
        croppedDataUrl = null;
      } catch (err) {
        addResult({ name: file.name, status: 'error', error: err.message });
      }

      // Yield to UI between images to prevent freezes and memory spikes
      // In browser preview mode, add a small delay to simulate real AI processing
      await new Promise((r) => setTimeout(r, mockMode ? 200 : 10));
    }

    if (!cancelledRef.current) {
      setStatus('done');
    }
  }, [state, isDropMode, cancelledRef, setStatus, setProgress, setCurrentFile, addResult, addPreviewPair, removeBg, bgColor, bgRemoverReady, mockMode]);

  // ─── Can start processing? ───
  const hasImages = state.imageFiles.length > 0;
  const hasOutput = !!state.outputFolder;
  const hasInput = isDropMode || !!state.inputFolder;

  const canStart =
    hasImages &&
    hasInput &&
    hasOutput &&
    state.workerReady &&
    (state.status === 'ready' || state.status === 'done' || state.status === 'cancelled' || state.status === 'error');

  const isProcessing = state.status === 'processing';

  const successCount = state.results.filter((r) => r.status === 'success').length;
  const errorCount = state.results.filter((r) => r.status === 'error').length;

  return (
    <div style={dashboardStyle}>
      {/* Header */}
      <div>
        <div style={headerTitleStyle}>Auto-Passport Crop</div>
        <div style={headerSubtitleStyle}>AI-powered passport photo cropping — 100% offline</div>
        {browserMode && (
          <div style={{
            marginTop: 8,
            padding: '8px 14px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 8,
            color: '#f59e0b',
            fontSize: 12,
            fontWeight: 500,
          }}>
            ⚡ Browser Preview Mode — Drop real images or use demo mode. Run in Electron for full file access.
          </div>
        )}
      </div>

      {/* Drag & Drop Zone */}
      <DropZone />

      {/* Separator */}
      <div style={separatorStyle}>
        <div style={separatorLineStyle} />
        <span>or use folder selection</span>
        <div style={separatorLineStyle} />
      </div>

      {/* Folder selectors */}
      <FolderSelector />

      {/* Stats Row */}
      <div style={statsRowStyle}>
        <div style={statCardStyle}>
          <span style={statLabelStyle}>Images</span>
          <span style={statValueStyle}>{state.imageFiles.length}</span>
        </div>
        <div style={statCardStyle}>
          <span style={statLabelStyle}>Processed</span>
          <span style={{ ...statValueStyle, color: '#22c55e' }}>{successCount}</span>
        </div>
        <div style={statCardStyle}>
          <span style={statLabelStyle}>Errors</span>
          <span style={{
            ...statValueStyle,
            color: errorCount > 0 ? '#ef4444' : '#f1f5f9'
          }}>
            {errorCount}
          </span>
        </div>
        <div style={statCardStyle}>
          <span style={statLabelStyle}>AI Engine</span>
          <span style={{
            ...statValueStyle,
            fontSize: 14,
            color: state.workerReady ? (mockMode ? '#f59e0b' : '#22c55e') : (isInitializing ? '#f59e0b' : '#64748b')
          }}>
            {state.workerReady ? (mockMode ? '● Mock Mode' : '● Ready') : (isInitializing ? '◐ Loading...' : '○ Not Loaded')}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {(isProcessing || state.status === 'done' || state.status === 'cancelled') && (
        <ProgressBar
          current={state.progress.current}
          total={state.progress.total}
          currentFile={state.currentFile}
          status={state.status}
        />
      )}

      {/* Background Removal Options */}
      <div style={bgRemovalCardStyle}>
        <div style={bgRemovalHeaderStyle}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>Remove Background</span>
            <span style={{ fontSize: 11, color: bgRemoverReady ? '#22c55e' : '#64748b', marginLeft: 8 }}>
              {bgRemoverReady ? '● Ready' : (isInitializing ? '◐ Loading...' : '○ Unavailable')}
            </span>
          </div>
          <div
            style={toggleTrackStyle(removeBg)}
            onClick={() => setRemoveBg(!removeBg)}
            role="switch"
            aria-checked={removeBg}
          >
            <div style={toggleThumbStyle(removeBg)} />
          </div>
        </div>

        {removeBg && (
          <div style={colorSwatchRowStyle}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              BG Color:
            </span>
            {PASSPORT_BG_COLORS.map(({ color, label }) => (
              <div
                key={color}
                style={colorSwatchStyle(bgColor === color, color)}
                onClick={() => setBgColor(color)}
                title={label}
              />
            ))}
            {/* Custom color picker */}
            <div style={{ position: 'relative' }}>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                style={{
                  ...customColorInputStyle,
                  opacity: 0,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  cursor: 'pointer',
                }}
                title="Custom color"
              />
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)`,
                border: !PASSPORT_BG_COLORS.find(c => c.color === bgColor) ? '2px solid #3b82f6' : '2px solid #475569',
                pointerEvents: 'none',
              }} />
            </div>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
              {PASSPORT_BG_COLORS.find(c => c.color === bgColor)?.label || bgColor}
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={controlsRowStyle}>
        <button
          style={canStart ? btnStart : btnStartDisabled}
          onClick={startProcessing}
          disabled={!canStart}
        >
          ▶ Start Processing
        </button>

        {isProcessing && (
          <button style={btnCancel} onClick={cancelProcessing}>
            ✕ Cancel
          </button>
        )}

        {(state.status === 'done' || state.status === 'cancelled' || state.status === 'error') && (
          <button style={btnReset} onClick={resetProcessing}>
            ↻ Reset
          </button>
        )}
      </div>

      {/* Preview grid */}
      {state.previewPairs.length > 0 && (
        <PreviewGrid pairs={state.previewPairs} />
      )}

      {/* Error display */}
      {state.error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 8,
          padding: '12px 16px',
          color: '#ef4444',
          fontSize: 13,
        }}>
          {state.error}
        </div>
      )}
    </div>
  );
}