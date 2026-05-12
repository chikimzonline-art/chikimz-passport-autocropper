import React from 'react';

const containerStyle = {
  background: '#1e293b',
  borderRadius: 10,
  padding: '14px 16px',
  border: '1px solid #334155',
};

const infoRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
};

const labelStyle = {
  fontSize: 12,
  color: '#94a3b8',
  fontWeight: 500,
};

const countStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: '#f1f5f9',
};

const trackStyle = {
  width: '100%',
  height: 8,
  background: '#0f172a',
  borderRadius: 4,
  overflow: 'hidden',
  position: 'relative',
};

const getStatusColor = (status) => {
  switch (status) {
    case 'processing': return '#3b82f6';
    case 'done': return '#22c55e';
    case 'cancelled': return '#f59e0b';
    default: return '#3b82f6';
  }
};

export default function ProgressBar({ current, total, currentFile, status }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const color = getStatusColor(status);

  const fillStyle = {
    height: '100%',
    width: `${pct}%`,
    background: `linear-gradient(90deg, ${color}, ${color}dd)`,
    borderRadius: 4,
    transition: 'width 0.3s ease',
    boxShadow: `0 0 10px ${color}44`,
  };

  return (
    <div style={containerStyle}>
      <div style={infoRowStyle}>
        <span style={labelStyle}>
          {status === 'done'
            ? '✓ Processing complete'
            : status === 'cancelled'
            ? '⚠ Processing cancelled'
            : `Processing: ${currentFile}`}
        </span>
        <span style={countStyle}>
          {current} / {total} ({pct}%)
        </span>
      </div>
      <div style={trackStyle}>
        <div style={fillStyle} />
      </div>
    </div>
  );
}
