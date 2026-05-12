import React, { useEffect } from 'react';
import { useProcessing } from '../hooks/useProcessing';
import { isElectron } from '../utils/electronMock';

const rowStyle = {
  display: 'flex',
  gap: 16,
  alignItems: 'stretch',
};

const folderCardStyle = {
  flex: 1,
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 10,
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  transition: 'border-color 0.2s',
};

const folderCardActiveStyle = {
  ...folderCardStyle,
  borderColor: '#3b82f6',
  boxShadow: '0 0 12px rgba(59, 130, 246, 0.15)',
};

const folderCardDropStyle = {
  ...folderCardStyle,
  borderColor: '#22c55e',
  boxShadow: '0 0 12px rgba(34, 197, 94, 0.15)',
};

const labelStyle = {
  fontSize: 11,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  fontWeight: 600,
};

const pathStyle = {
  fontSize: 13,
  color: '#94a3b8',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const btnStyle = {
  padding: '8px 16px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  border: '1px solid #334155',
  background: '#334155',
  color: '#f1f5f9',
  cursor: 'pointer',
  transition: 'all 0.2s',
  alignSelf: 'flex-start',
};

export default function FolderSelector() {
  const { state, setInputFolder, setOutputFolder, setImageFiles, setDroppedFiles, setStatus } = useProcessing();

  const browserMode = !isElectron();
  const isDropMode = state.imageFiles.length > 0 && state.imageFiles[0]?.source === 'drop';

  // In browser preview mode, auto-select demo folders on mount
  useEffect(() => {
    if (browserMode && !state.inputFolder && !isDropMode) {
      autoSelectDemo();
    }
  }, [browserMode]);

  const autoSelectDemo = async () => {
    const inputFolder = '/demo/input-folder';
    const outputFolder = '/demo/output-folder';
    setInputFolder(inputFolder);
    setOutputFolder(outputFolder);
    const result = await window.electronAPI.listImages(inputFolder);
    if (result.success) {
      setImageFiles(result.files);
    }
  };

  const handleSelectInput = async () => {
    const folder = await window.electronAPI.selectInputFolder();
    if (folder) {
      setInputFolder(folder);
      setDroppedFiles(null); // Clear any drop-based files
      const result = await window.electronAPI.listImages(folder);
      if (result.success) {
        setImageFiles(result.files);
        if (result.files.length === 0) {
          setStatus('error');
        }
      } else {
        setImageFiles([]);
      }
    }
  };

  const handleSelectOutput = async () => {
    const folder = await window.electronAPI.selectOutputFolder();
    if (folder) {
      setOutputFolder(folder);
    }
  };

  // Determine input card style
  let inputCardStyle = folderCardStyle;
  if (isDropMode) {
    inputCardStyle = folderCardDropStyle;
  } else if (state.inputFolder) {
    inputCardStyle = folderCardActiveStyle;
  }

  return (
    <div style={rowStyle}>
      <div style={inputCardStyle}>
        <span style={labelStyle}>
          {isDropMode ? '📥 Dropped Images' : (browserMode ? '📁 Demo Input (8 portraits)' : '📁 Input Folder')}
        </span>
        {isDropMode ? (
          <span style={{ ...pathStyle, color: '#22c55e' }}>
            {state.imageFiles.length} image{state.imageFiles.length !== 1 ? 's' : ''} via drag & drop
          </span>
        ) : state.inputFolder ? (
          <span style={pathStyle} title={state.inputFolder}>{state.inputFolder}</span>
        ) : (
          <span style={{ ...pathStyle, color: '#475569', fontStyle: 'italic' }}>
            No folder selected
          </span>
        )}
        {!isDropMode && (
          <button style={btnStyle} onClick={handleSelectInput}>
            {state.inputFolder ? 'Rescan' : 'Browse...'}
          </button>
        )}
      </div>

      <div style={state.outputFolder ? folderCardActiveStyle : folderCardStyle}>
        <span style={labelStyle}>
          {browserMode ? '💾 Demo Output (simulated)' : '💾 Output Folder'}
        </span>
        {state.outputFolder ? (
          <span style={pathStyle} title={state.outputFolder}>{state.outputFolder}</span>
        ) : (
          <span style={{ ...pathStyle, color: '#475569', fontStyle: 'italic' }}>
            No folder selected
          </span>
        )}
        <button style={btnStyle} onClick={handleSelectOutput}>
          {state.outputFolder ? 'Change' : 'Browse...'}
        </button>
      </div>
    </div>
  );
}
