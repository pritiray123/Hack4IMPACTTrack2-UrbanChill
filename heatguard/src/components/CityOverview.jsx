import React, { useContext } from 'react';
import { getRisk } from '../utils/riskHelpers';
import { LanguageContext } from '../context/LanguageContext';

export default function CityOverview({ zones, cityName, onZoneSelect, afterMode }) {
  const { t } = useContext(LanguageContext);
  const temps = zones.map((z) => (afterMode ? z.temp * 0.82 : z.temp));
  const avgTemp = (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
  const criticalCount = temps.filter((t) => t >= 40).length;
  const highCount = temps.filter((t) => t >= 36 && t < 40).length;
  const avgGreenCover = (zones.reduce((a, z) => a + z.greenCover, 0) / zones.length).toFixed(1);
  const avgAQI = Math.round(zones.reduce((a, z) => a + z.aqi, 0) / zones.length);

  // Sort by temp descending, take top 6
  const hottest = [...zones]
    .sort((a, b) => b.temp - a.temp)
    .slice(0, 6);

  return (
    <div className="city-overview fade-in">
      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '16px', marginBottom: '14px' }}>
        {cityName || 'City'} {t('overview')}
      </h3>

      <div className="overview-stats">
        <div className="overview-stat">
          <span className="overview-stat-value" style={{ color: 'var(--warn)' }}>{avgTemp}°C</span>
          <span className="overview-stat-label">{t('avg_temp')}</span>
        </div>
        <div className="overview-stat">
          <span className="overview-stat-value" style={{ color: 'var(--critical)' }}>{criticalCount}</span>
          <span className="overview-stat-label">{t('critical')}</span>
        </div>
        <div className="overview-stat">
          <span className="overview-stat-value" style={{ color: 'var(--danger)' }}>{highCount}</span>
          <span className="overview-stat-label">{t('high_risk')}</span>
        </div>
        <div className="overview-stat">
          <span className="overview-stat-value" style={{ color: 'var(--accent)' }}>{avgGreenCover}%</span>
          <span className="overview-stat-label">{t('green_cover')}</span>
        </div>
        <div className="overview-stat">
          <span className="overview-stat-value" style={{ color: 'var(--info)' }}>{avgAQI}</span>
          <span className="overview-stat-label">{t('avg_aqi')}</span>
        </div>
        <div className="overview-stat">
          <span className="overview-stat-value">{zones.length}</span>
          <span className="overview-stat-label">{t('zones')}</span>
        </div>
      </div>

      <div className="hottest-title">🔥 {t('hottest_zones')}</div>
      {hottest.map((zone, i) => {
        const temp = afterMode ? +(zone.temp * 0.82).toFixed(1) : zone.temp;
        const risk = getRisk(temp);
        return (
          <div
            className="hottest-item"
            key={zone.id}
            onClick={() => onZoneSelect(zone)}
          >
            <span className="hottest-rank">#{i + 1}</span>
            <span className="hottest-name">{zone.name}</span>
            <span className="hottest-temp" style={{ color: risk.color }}>{temp}°C</span>
          </div>
        );
      })}
    </div>
  );
}
