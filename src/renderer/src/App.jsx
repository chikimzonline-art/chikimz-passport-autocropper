import React from 'react';
import TitleBar from './components/TitleBar';
import Dashboard from './components/Dashboard';
import StatusBar from './components/StatusBar';
import { ProcessingProvider, useProcessing } from './hooks/useProcessing';
import './styles/global.css';

function AppLayout() {
  const { state } = useProcessing();

  return (
    <>
      <TitleBar />
      <Dashboard />
      <StatusBar status={state.status} />
    </>
  );
}

export default function App() {
  return (
    <ProcessingProvider>
      <AppLayout />
    </ProcessingProvider>
  );
}