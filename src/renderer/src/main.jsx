import React from 'react';
import ReactDOM from 'react-dom/client';
import { installElectronMock } from './utils/electronMock';
import App from './App';
import './styles/global.css';

// Install Electron API mocks if running in a plain browser (not Electron)
installElectronMock();

// Prevent default browser drag-and-drop behavior (opening files in browser)
// This ensures our custom DropZone component handles all file drops
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
