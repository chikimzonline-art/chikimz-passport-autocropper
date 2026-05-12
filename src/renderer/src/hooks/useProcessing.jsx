import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';

const ProcessingContext = createContext(null);

// ─── State Shape ───
const initialState = {
  inputFolder: null,
  outputFolder: null,
  imageFiles: [],         // Array of { name, fullPath, ext, source? }
  droppedFiles: null,     // In-memory data URLs for browser/drop mode: Array of { name, dataUrl } or null
  status: 'idle',         // idle | loading | ready | processing | done | error | cancelled
  progress: { current: 0, total: 0 },
  currentFile: '',
  previewPairs: [],       // Last 5 { original, cropped, name }
  results: [],            // { name, status: 'success'|'error', error? }
  workerReady: false,
  error: null,
};

// ─── Reducer ───
function reducer(state, action) {
  switch (action.type) {
    case 'SET_INPUT_FOLDER':
      return { ...state, inputFolder: action.payload };
    case 'SET_OUTPUT_FOLDER':
      return { ...state, outputFolder: action.payload };
    case 'SET_IMAGE_FILES':
      return { ...state, imageFiles: action.payload, status: 'ready' };
    case 'SET_DROPPED_FILES':
      return { ...state, droppedFiles: action.payload };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_WORKER_READY':
      return { ...state, workerReady: action.payload };
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload };
    case 'SET_CURRENT_FILE':
      return { ...state, currentFile: action.payload };
    case 'ADD_PREVIEW_PAIR':
      return {
        ...state,
        previewPairs: [...state.previewPairs, action.payload].slice(-5),
      };
    case 'ADD_RESULT':
      // Cap results at 500 entries to prevent unbounded memory growth.
      // Older results are trimmed from the start. The UI only shows stats
      // (success/error counts), so losing very old individual results is acceptable.
      const nextResults = [...state.results, action.payload];
      return {
        ...state,
        results: nextResults.length > 500 ? nextResults.slice(-500) : nextResults,
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload, status: 'error' };
    case 'CANCEL':
      return { ...state, status: 'cancelled' };
    case 'RESET':
      return {
        ...initialState,
        inputFolder: state.inputFolder,
        outputFolder: state.outputFolder,
        workerReady: state.workerReady,
      };
    default:
      return state;
  }
}

export function ProcessingProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const workerRef = useRef(null);
  const cancelledRef = useRef(false);

  return (
    <ProcessingContext.Provider value={{ state, dispatch, workerRef, cancelledRef }}>
      {children}
    </ProcessingContext.Provider>
  );
}

export function useProcessing() {
  const context = useContext(ProcessingContext);
  if (!context) throw new Error('useProcessing must be used within ProcessingProvider');
  const { state, dispatch, workerRef, cancelledRef } = context;

  const setInputFolder = useCallback((folder) => {
    dispatch({ type: 'SET_INPUT_FOLDER', payload: folder });
  }, [dispatch]);

  const setOutputFolder = useCallback((folder) => {
    dispatch({ type: 'SET_OUTPUT_FOLDER', payload: folder });
  }, [dispatch]);

  const setImageFiles = useCallback((files) => {
    dispatch({ type: 'SET_IMAGE_FILES', payload: files });
  }, [dispatch]);

  const setDroppedFiles = useCallback((files) => {
    dispatch({ type: 'SET_DROPPED_FILES', payload: files });
  }, [dispatch]);

  const setWorkerReady = useCallback((ready) => {
    dispatch({ type: 'SET_WORKER_READY', payload: ready });
  }, [dispatch]);

  const addPreviewPair = useCallback((pair) => {
    dispatch({ type: 'ADD_PREVIEW_PAIR', payload: pair });
  }, [dispatch]);

  const addResult = useCallback((result) => {
    dispatch({ type: 'ADD_RESULT', payload: result });
  }, [dispatch]);

  const setError = useCallback((err) => {
    dispatch({ type: 'SET_ERROR', payload: err });
  }, [dispatch]);

  const cancelProcessing = useCallback(() => {
    cancelledRef.current = true;
    dispatch({ type: 'CANCEL' });
  }, [dispatch, cancelledRef]);

  const resetProcessing = useCallback(() => {
    cancelledRef.current = false;
    dispatch({ type: 'RESET' });
  }, [dispatch, cancelledRef]);

  const setProgress = useCallback((current, total) => {
    dispatch({ type: 'SET_PROGRESS', payload: { current, total } });
  }, [dispatch]);

  const setCurrentFile = useCallback((name) => {
    dispatch({ type: 'SET_CURRENT_FILE', payload: name });
  }, [dispatch]);

  const setStatus = useCallback((status) => {
    dispatch({ type: 'SET_STATUS', payload: status });
  }, [dispatch]);

  return {
    state,
    setInputFolder,
    setOutputFolder,
    setImageFiles,
    setDroppedFiles,
    setWorkerReady,
    addPreviewPair,
    addResult,
    setError,
    cancelProcessing,
    resetProcessing,
    setProgress,
    setCurrentFile,
    setStatus,
    workerRef,
    cancelledRef,
  };
}
