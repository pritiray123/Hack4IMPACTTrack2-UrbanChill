import React, { useContext } from 'react';
import { LanguageContext } from '../context/LanguageContext';

export default function BottomBar({ afterMode, onToggle, lastUpdated, onLocateMe }) {
  const { t } = useContext(LanguageContext);
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
          {t('current')}
        </button>
        <button
          className={`toggle-btn ${afterMode ? 'active' : ''}`}
          onClick={() => onToggle(true)}
          id="toggle-after"
        >
          {t('after_interventions')}
        </button>
      </div>

      {onLocateMe && (
        <button 
          className="btn" 
          onClick={onLocateMe}
          style={{ background: 'var(--info)', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
          {t('locate_me')}
        </button>
      )}
      </div>

      <span className="bottombar-note">
        {afterMode
          ? `🌿 ${t('showing_projected')}`
          : `📡 ${t('showing_current')}`}
        {lastUpdated && !afterMode && (
          <span style={{ marginLeft: '10px', color: 'var(--accent)', opacity: 0.8 }}>
            ({t('last_updated')}: {getMinutesAgo()})
          </span>
        )}
      </span>

      <span className="bottombar-brand">UrbanChill × HeatGuard</span>
    </div>
  );
}
