import React from 'react';
import { isElectron } from '../utils/electronMock';

const barStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 10px',
  marginRight: 10,
  marginLeft: 10,
  borderTop: '1px solid #1e293b',
  fontSize: 11,
  color: '#475569',
  flexShrink: 0,
};

const dotStyle = (color) => ({
  display: 'inline-block',
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: color,
  marginRight: 6,
});

const statusMap = {
  idle: { label: 'Ready', color: '#64748b' },
  loading: { label: 'Loading...', color: '#f59e0b' },
  ready: { label: 'Ready to process', color: '#22c55e' },
  processing: { label: 'Processing...', color: '#3b82f6' },
  done: { label: 'Complete', color: '#22c55e' },
  error: { label: 'Error', color: '#ef4444' },
  cancelled: { label: 'Cancelled', color: '#f59e0b' },
};

export default function StatusBar({ status }) {
  const info = statusMap[status] || statusMap.idle;
  const browserMode = !isElectron();

  return (
    <div style={barStyle}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={dotStyle(info.color)} />
        <span>{info.label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>Auto-Passport Crop v1.0 — {browserMode ? 'Browser Preview' : 'Offline Mode'}</span>
        <span style={{ color: '#64748b' }}>|</span>
        <span style={{ color: '#94a3b8' }}>Developed by CSC Chikimz Online</span>
      </div>
    </div>
  );
}
