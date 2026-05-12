import React from 'react';

const titleBarStyle = {
  height: 38,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
  borderBottom: '1px solid #334155',
  WebkitAppRegion: 'drag',
  flexShrink: 0,
};

const titleStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: '#94a3b8',
  letterSpacing: '0.5px',
};

const iconStyle = {
  marginRight: 8,
  fontSize: 16,
};

export default function TitleBar() {
  return (
    <div style={titleBarStyle} className="drag-region">
      <span style={iconStyle}>&#x1F4F7;</span>
      <span style={titleStyle}>AUTO-PASSPORT CROP</span>
    </div>
  );
}
