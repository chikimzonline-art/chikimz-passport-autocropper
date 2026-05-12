import React from 'react';

const sectionStyle = {
  flex: 1,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const titleStyle = {
  fontSize: 13,
  color: '#94a3b8',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  marginBottom: 10,
};

const gridStyle = {
  display: 'flex',
  gap: 12,
  overflowX: 'auto',
  paddingBottom: 4,
  flex: 1,
};

const cardStyle = {
  minWidth: 200,
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 10,
  overflow: 'hidden',
  flexShrink: 0,
};

const imageRowStyle = {
  display: 'flex',
  gap: 4,
  padding: 6,
  justifyContent: 'center',
};

const imageBoxStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 3,
};

const imgStyle = {
  width: 80,
  height: 102,
  objectFit: 'cover',
  borderRadius: 4,
  border: '1px solid #334155',
};

const imgLabelStyle = {
  fontSize: 9,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const nameStyle = {
  padding: '6px 10px',
  fontSize: 11,
  color: '#94a3b8',
  borderTop: '1px solid #334155',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'center',
};

export default function PreviewGrid({ pairs }) {
  if (!pairs || pairs.length === 0) return null;

  return (
    <div style={sectionStyle}>
      <div style={titleStyle}>Preview — Last {pairs.length} Processed</div>
      <div style={gridStyle}>
        {pairs.map((pair, idx) => (
          <div key={`${pair.name}-${idx}`} style={cardStyle}>
            <div style={imageRowStyle}>
              <div style={imageBoxStyle}>
                <img src={pair.original} alt="Original" style={imgStyle} />
                <span style={imgLabelStyle}>Original</span>
              </div>
              <div style={imageBoxStyle}>
                <img src={pair.cropped} alt="Cropped" style={imgStyle} />
                <span style={imgLabelStyle}>Passport</span>
              </div>
            </div>
            <div style={nameStyle} title={pair.name}>
              {pair.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
