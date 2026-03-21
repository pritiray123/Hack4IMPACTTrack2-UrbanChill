import React from 'react';

export default function BottomBar({ afterMode, onToggle, lastUpdated, onLocateMe }) {
  const getMinutesAgo = () => {
    if (!lastUpdated) return '';
    const diff = Math.floor((new Date() - lastUpdated) / 60000);
    return diff === 0 ? 'just now' : `${diff} mins ago`;
  };

  return (
    <div className="bottombar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="toggle-group">
        <button
          className={`toggle-btn ${!afterMode ? 'active' : ''}`}
          onClick={() => onToggle(false)}
          id="toggle-current"
        >
          Current
        </button>
        <button
          className={`toggle-btn ${afterMode ? 'active' : ''}`}
          onClick={() => onToggle(true)}
          id="toggle-after"
        >
          After Interventions
        </button>
      </div>

      {onLocateMe && (
        <button 
          className="btn" 
          onClick={onLocateMe}
          style={{ background: 'var(--info)', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
          Locate Me
        </button>
      )}
      </div>

      <span className="bottombar-note">
        {afterMode
          ? '🌿 Showing projected temperatures after green interventions (18% avg reduction)'
          : '📡 Showing current surface temperature data'}
        {lastUpdated && !afterMode && (
          <span style={{ marginLeft: '10px', color: 'var(--accent)', opacity: 0.8 }}>
            (Last updated: {getMinutesAgo()})
          </span>
        )}
      </span>

      <span className="bottombar-brand">UrbanChill × HeatGuard</span>
    </div>
  );
}
