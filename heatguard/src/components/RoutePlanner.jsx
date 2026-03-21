import React, { useState, useContext } from 'react';
import { LanguageContext } from '../context/LanguageContext';

export default function RoutePlanner({ onPlanRoute, loading, advisory, userLocation }) {
  const { t } = useContext(LanguageContext);
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState('bus');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (source.trim() && destination.trim()) {
      onPlanRoute(source.trim(), destination.trim(), mode);
    }
  };

  return (
    <div className="route-planner fade-in">
      <h3 style={{ marginBottom: "16px", color: "var(--accent)" }}>☀️ {t('heat_aware_route_planner')}</h3>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <label style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t('origin')}</label>
            {userLocation && (
              <button 
                type="button" 
                onClick={() => setSource("My Location")} 
                style={{ background: "transparent", border: "none", color: "var(--info)", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
              >
                📍 {t('use_my_location')}
              </button>
            )}
          </div>
          <input 
            type="text" 
            value={source} 
            onChange={(e) => setSource(e.target.value)} 
            placeholder="e.g. Andheri" 
            style={{ width: "100%", padding: "10px", background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "4px", outline: "none", fontSize: "14px" }}
            required
          />
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
            <label style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t('destination')}</label>
            {userLocation && (
              <button 
                type="button" 
                onClick={() => setDestination("My Location")} 
                style={{ background: "transparent", border: "none", color: "var(--info)", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
              >
                📍 {t('use_my_location')}
              </button>
            )}
          </div>
          <input 
            type="text" 
            value={destination} 
            onChange={(e) => setDestination(e.target.value)} 
            placeholder="e.g. Bandra" 
            style={{ width: "100%", padding: "10px", background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "4px", outline: "none", fontSize: "14px" }}
            required
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "11px", color: "var(--muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t('transport_mode')}</label>
          <select 
            value={mode} 
            onChange={(e) => setMode(e.target.value)}
            style={{ width: "100%", padding: "10px", background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "4px", outline: "none", fontSize: "14px" }}
          >
            <option value="bus">{t('bus_transport')} 🚌</option>
            <option value="bike">{t('motorbike')} 🏍️</option>
            <option value="cycle">{t('cycle')} 🚴</option>
            <option value="walk">{t('walking')} 🚶</option>
          </select>
        </div>
        
        <button type="submit" className="btn" disabled={loading} style={{ marginTop: "12px", padding: "12px", fontSize: "14px" }}>
          {loading ? t('analyzing_route') : t('plan_safe_route')}
        </button>
      </form>

      {loading && (
        <div className="ai-loading fade-in">
          <div className="ai-spinner"></div>
          <p>{t('analyzing_route')}</p>
        </div>
      )}

      {advisory && !loading && (
        <div className="advisory-results fade-in">
          <div className="metric-card" style={{ marginBottom: "16px", borderLeft: "4px solid var(--accent)", background: "rgba(63, 185, 80, 0.05)" }}>
            <span className="metric-label" style={{ color: "var(--accent)", fontWeight: "bold" }}>{t('optimized_green_route_found')}</span>
            <span className="metric-value" style={{ fontSize: "13px", lineHeight: "1.5", marginTop: "4px" }}>{advisory.route_analysis}</span>
          </div>

          <div className="metric-card" style={{ marginBottom: "16px" }}>
            <span className="metric-label">{t('estimated_expense')}</span>
            <span className="metric-value">{advisory.estimated_cost}</span>
            <span className="metric-sub">{t('via')} {mode.toUpperCase()}</span>
          </div>

          <div className="ai-summary-card" style={{ marginTop: "16px", background: "linear-gradient(135deg, rgba(56, 139, 253, 0.1), rgba(63, 185, 80, 0.05))" }}>
            <div className="ai-title" style={{ color: "var(--info)", marginBottom: "12px" }}>💧 {t('hydration_plan')}</div>
            <div className="ai-summary-text" style={{ fontSize: "13px", fontWeight: "bold", marginBottom: "8px" }}>
              🚰 {t('carry_from_home')}: <span style={{ color: "var(--accent)" }}>{advisory.water_to_carry}</span>
            </div>
            <ul style={{ paddingLeft: "16px", fontSize: "13px", color: "var(--text)", lineHeight: "1.6" }}>
              {advisory.hydration_stops.map((stop, i) => (
                <li key={i} style={{ marginBottom: "4px" }}>{stop}</li>
              ))}
            </ul>
          </div>

          <div className="ai-summary-card" style={{ marginTop: "16px" }}>
            <div className="ai-title" style={{ color: "var(--accent)", marginBottom: "12px" }}>🌳 {t('shaded_rest_stops')}</div>
            <ul style={{ paddingLeft: "16px", fontSize: "13px", color: "var(--text)", lineHeight: "1.6" }}>
              {advisory.rest_stops.map((stop, i) => (
                <li key={i} style={{ marginBottom: "4px" }}>{stop}</li>
              ))}
            </ul>
          </div>

          <div className="ai-title" style={{ marginTop: "20px" }}>{t('general_precautions')}</div>
          {advisory.precautions.map((p, i) => (
             <div key={i} className="intervention-card" style={{ padding: "12px", marginBottom: "8px", borderLeft: "2px solid var(--danger)" }}>
               <div className="intervention-action" style={{ margin: 0, fontSize: "13px" }}>{p}</div>
             </div>
          ))}
          
          <div style={{ marginTop: "16px", padding: "14px", background: "var(--surface2)", borderLeft: "3px solid var(--warn)", borderRadius: "var(--radius-sm)"}}>
             <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", fontStyle: "italic" }}>{advisory.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
