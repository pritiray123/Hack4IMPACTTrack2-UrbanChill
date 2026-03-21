import React, { useContext } from 'react';
import ZoneDetail from './ZoneDetail';
import AIPanel from './AIPanel';
import CityOverview from './CityOverview';
import HistoryPanel from './HistoryPanel';
import RoutePlanner from './RoutePlanner';
import { LanguageContext } from '../context/LanguageContext';

export default function Sidebar({
  activeTab,
  onTabChange,
  selectedZone,
  recommendations,
  recLoading,
  zones,
  cityName,
  onZoneSelect,
  afterMode,
  onPlanRoute,
  routeLoading,
  routeAdvisory,
  userLocation,
  onCloseZone
}) {
  const { t } = useContext(LanguageContext);

  return (
    <div className="sidebar">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === 'zone' ? 'active' : ''}`}
          onClick={() => onTabChange('zone')}
          id="tab-zone-analysis"
        >
          {t('zone_analysis')}
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => onTabChange('overview')}
          id="tab-city-overview"
        >
          {t('city_overview')}
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => onTabChange('history')}
          id="tab-history"
        >
          {t('history')}
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'route' ? 'active' : ''}`}
          onClick={() => onTabChange('route')}
          id="tab-route"
        >
          {t('route')}
        </button>
      </div>

      <div className="sidebar-content">
        {activeTab === 'zone' ? (
          selectedZone ? (
            <div className="fade-in" style={{ position: 'relative' }}>
              {onCloseZone && (
                <button
                  onClick={onCloseZone}
                  title="Close zone analysis"
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 10,
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '6px',
                    color: '#7d8590',
                    cursor: 'pointer',
                    fontSize: 16,
                    lineHeight: 1,
                    padding: '4px 8px',
                    transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.color = '#e6edf3'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                  onMouseOut={e => { e.currentTarget.style.color = '#7d8590'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                >
                  ✕
                </button>
              )}
              <ZoneDetail zone={selectedZone} afterMode={afterMode} />
              <AIPanel recommendations={recommendations} loading={recLoading} zone={selectedZone} cityName={cityName} />
            </div>
          ) : (
            <div className="sidebar-empty">
              <div className="sidebar-empty-icon">📍</div>
              <p>Click a zone on the map to view detailed heat analysis and AI recommendations</p>
            </div>
          )
        ) : activeTab === 'history' ? (
          <HistoryPanel />
        ) : activeTab === 'route' ? (
          <RoutePlanner 
            onPlanRoute={onPlanRoute} 
            loading={routeLoading} 
            advisory={routeAdvisory} 
            userLocation={userLocation}
          />
        ) : (
          zones.length > 0 ? (
            <CityOverview
              zones={zones}
              cityName={cityName}
              onZoneSelect={onZoneSelect}
              afterMode={afterMode}
            />
          ) : (
            <div className="sidebar-empty">
              <div className="sidebar-empty-icon">🏙️</div>
              <p>Search for a city to see overview statistics</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
