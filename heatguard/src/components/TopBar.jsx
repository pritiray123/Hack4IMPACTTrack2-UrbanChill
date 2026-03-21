import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { LanguageContext } from '../context/LanguageContext';

export default function TopBar({ onSearch, stats, loading, isMobile, sidebarOpen, onToggleSidebar }) {
  const [input, setInput] = React.useState('');
  const { user, openAuthModal, logout } = useContext(AuthContext);
  const { lang, setLang, t } = useContext(LanguageContext);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) onSearch(input.trim());
  };

  return (
    <div className="topbar">
      {isMobile && (
        <button 
          className="mobile-toggle" 
          onClick={onToggleSidebar}
          aria-label="Toggle Sidebar"
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>
      )}
      <div className="topbar-logo">
        Heat<span>Guard</span>
      </div>

      <form className="topbar-search" onSubmit={handleSubmit}>
        <input
          id="city-search-input"
          type="text"
          placeholder={t('search_placeholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn" type="submit" id="analyse-btn" disabled={loading}>
          {loading ? t('loading') : t('analyse_btn')}
        </button>
      </form>

      {stats && (
        <div className="stats-strip fade-in">
          <div className="stat-item">
            <span className="stat-value" style={{ color: 'var(--warn)' }}>
              {stats.avgTemp}°C
            </span>
            <span className="stat-label">{t('avg_temp')}</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" style={{ color: 'var(--danger)' }}>
              {stats.maxTemp}°C
            </span>
            <span className="stat-label">{t('max_temp')}</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" style={{ color: 'var(--warn)' }}>
              {stats.atRiskZones}
            </span>
            <span className="stat-label">{t('at_risk')}</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" style={{ color: 'var(--accent)' }}>
              {stats.avgGreenCover}%
            </span>
            <span className="stat-label">{t('green_cover')}</span>
          </div>
        </div>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '15px' }}>
        <select 
          value={lang} 
          onChange={(e) => setLang(e.target.value)}
          style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '5px' }}
        >
          <option value="en">English</option>
          <option value="hi">हिंदी</option>
          <option value="ta">தமிழ்</option>
          <option value="te">తెలుగు</option>
        </select>
        {user ? (
          <>
            <div className="user-avatar" title={user.email} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {user.email.charAt(0).toUpperCase()}
            </div>
            <button className="btn" onClick={logout} style={{ background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)' }}>{t('logout')}</button>
          </>
        ) : (
          <button className="btn" onClick={openAuthModal}>{t('login_signup')}</button>
        )}
      </div>
    </div>
  );
}
