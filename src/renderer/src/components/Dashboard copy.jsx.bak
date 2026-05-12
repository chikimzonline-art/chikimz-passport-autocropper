import React, { useEffect, useState, useCallback } from 'react';
import { useProcessing } from '../hooks/useProcessing';
import FolderSelector from './FolderSelector';
import DropZone from './DropZone';
import ProgressBar from './ProgressBar';
import PreviewGrid from './PreviewGrid';
import StatusBar from './StatusBar';
import { initializeFaceDetector, detectFaces, shutdownFaceDetector, isMockMode } from '../utils/faceDetector';
import { isElectron } from '../utils/electronMock';
import { computePassportCrop, applyCrop } from '../utils/cropPassport';

const dashboardStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
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

  useEffect(() => {
    setBrowserMode(!isElectron());
  }, []);

  // ─── Initialize FaceDetector on mount ───
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
        const detections = detectFaces(img);

        if (!detections || detections.length === 0) {
          // Release Image element memory when no face detected
          img.src = '';
          addResult({ name: file.name, status: 'error', error: 'No face detected' });
          await yieldToUI();
          continue;
        }

        // Step 4: Compute passport crop rectangle
        const bestDetection = detections[0];
        const cropRect = computePassportCrop(bestDetection, img.naturalWidth, img.naturalHeight);

        // Release Image element — no longer needed after crop rect is computed
        img.src = '';

        // Step 5: Apply the crop (produces passport-sized JPEG)
        let croppedDataUrl = await applyCrop(imageDataUrl, cropRect);

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
  }, [state, isDropMode, cancelledRef, setStatus, setProgress, setCurrentFile, addResult, addPreviewPair]);

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

      {/* Status bar */}
      <StatusBar status={state.status} />
    </div>
  );
}
