import React, { useState, useCallback, useRef } from 'react';
import { useProcessing } from '../hooks/useProcessing';
import { isElectron } from '../utils/electronMock';

const validExtensions = ['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff', '.tif'];

function isImageFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  return validExtensions.includes(ext);
}

// ─── Styles ───

const dropZoneBase = {
  border: '2px dashed #334155',
  borderRadius: 12,
  padding: '32px 24px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  transition: 'all 0.25s ease',
  cursor: 'pointer',
  minHeight: 120,
  background: '#0f172a',
  position: 'relative',
};

const dropZoneIdle = {
  ...dropZoneBase,
  borderColor: '#334155',
  background: 'rgba(15, 23, 42, 0.6)',
};

const dropZoneHover = {
  ...dropZoneBase,
  borderColor: '#3b82f6',
  background: 'rgba(59, 130, 246, 0.08)',
  boxShadow: '0 0 24px rgba(59, 130, 246, 0.15), inset 0 0 24px rgba(59, 130, 246, 0.05)',
};

const dropZoneHasFiles = {
  ...dropZoneBase,
  borderColor: '#22c55e',
  background: 'rgba(34, 197, 94, 0.05)',
  borderStyle: 'solid',
};

const iconStyle = {
  fontSize: 32,
  opacity: 0.6,
  transition: 'all 0.25s',
};

const mainTextStyle = {
  fontSize: 14,
  fontWeight: 600,
  color: '#94a3b8',
  textAlign: 'center',
};

const subTextStyle = {
  fontSize: 12,
  color: '#64748b',
  textAlign: 'center',
};

const fileCountBadge = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 14px',
  background: 'rgba(34, 197, 94, 0.15)',
  border: '1px solid rgba(34, 197, 94, 0.3)',
  borderRadius: 20,
  color: '#22c55e',
  fontSize: 13,
  fontWeight: 600,
};

const clearBtnStyle = {
  position: 'absolute',
  top: 8,
  right: 8,
  background: 'rgba(239, 68, 68, 0.15)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: 6,
  color: '#ef4444',
  fontSize: 11,
  fontWeight: 600,
  padding: '4px 10px',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

export default function DropZone() {
  const { state, setImageFiles, setDroppedFiles, setInputFolder, setOutputFolder, setStatus } = useProcessing();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const inElectron = isElectron();

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set drag over false if we're leaving the drop zone itself
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  }, []);

  const processDroppedFiles = useCallback(async (files) => {
    // Filter to image files only
    const imageFiles = Array.from(files).filter(isImageFile);

    if (imageFiles.length === 0) {
      return;
    }

    // Clear any folder-based selection
    setInputFolder(null);

    if (inElectron) {
      // In Electron: use webUtils.getPathForFile() to get real file paths
      const fileEntries = imageFiles.map((file) => {
        const filePath = window.electronAPI.getPathForFile(file);
        return {
          name: file.name,
          fullPath: filePath || file.name,
          ext: '.' + file.name.split('.').pop().toLowerCase(),
          source: 'drop',
        };
      }).filter((f) => f.fullPath); // Only include files with valid paths

      if (fileEntries.length === 0) return;

      setImageFiles(fileEntries);
      setDroppedFiles(null); // No in-memory data needed, will read via IPC

      // Auto-prompt for output folder if not set
      if (!state.outputFolder) {
        const folder = await window.electronAPI.selectOutputFolder();
        if (folder) {
          setOutputFolder(folder);
        }
      }
    } else {
      // In browser: read files as data URLs using FileReader
      const readPromises = imageFiles.map((file) => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              name: file.name,
              fullPath: file.name, // No real path in browser
              ext: '.' + file.name.split('.').pop().toLowerCase(),
              dataUrl: reader.result,
              source: 'drop',
            });
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
      });

      const results = await Promise.all(readPromises);
      const validResults = results.filter(Boolean);

      if (validResults.length === 0) return;

      setImageFiles(validResults);
      setDroppedFiles(validResults); // Store in-memory data URLs for browser mode

      // Auto-set demo output folder
      if (!state.outputFolder) {
        setOutputFolder('/demo/output-folder');
      }
    }

    setIsDragOver(false);
  }, [inElectron, setInputFolder, setOutputFolder, setImageFiles, setDroppedFiles, state.outputFolder]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processDroppedFiles(files);
    }
  }, [processDroppedFiles]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e) => {
    const files = e.target.files;
    if (files.length > 0) {
      processDroppedFiles(files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [processDroppedFiles]);

  const handleClear = useCallback((e) => {
    e.stopPropagation();
    setImageFiles([]);
    setDroppedFiles(null);
    setInputFolder(null);
    setStatus('idle');
  }, [setImageFiles, setDroppedFiles, setInputFolder, setStatus]);

  const hasFiles = state.imageFiles.length > 0 && state.imageFiles[0]?.source === 'drop';
  const dragOver = isDragOver && !hasFiles;

  let containerStyle;
  if (hasFiles) {
    containerStyle = dropZoneHasFiles;
  } else if (dragOver) {
    containerStyle = dropZoneHover;
  } else {
    containerStyle = dropZoneIdle;
  }

  return (
    <div
      style={containerStyle}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {hasFiles ? (
        <>
          <button style={clearBtnStyle} onClick={handleClear}>
            ✕ Clear
          </button>
          <span style={{ ...iconStyle, opacity: 1 }}>✅</span>
          <div style={fileCountBadge}>
            📸 {state.imageFiles.length} image{state.imageFiles.length !== 1 ? 's' : ''} ready
          </div>
          <div style={subTextStyle}>Drop more to replace, or click to browse</div>
        </>
      ) : (
        <>
          <span style={{ ...iconStyle, opacity: dragOver ? 1 : 0.5 }}>
            {dragOver ? '📥' : '📂'}
          </span>
          <div style={{ ...mainTextStyle, color: dragOver ? '#3b82f6' : '#94a3b8' }}>
            {dragOver ? 'Drop images here!' : 'Drag & drop images here'}
          </div>
          <div style={subTextStyle}>
            or click to browse — JPG, PNG, BMP, WebP, TIFF
          </div>
        </>
      )}
    </div>
  );
}
