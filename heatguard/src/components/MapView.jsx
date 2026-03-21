import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import { getRisk } from '../utils/riskHelpers';

// Google Maps-style road tile (standard Maps look, with English labels)
const TILE_URL = 'https://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}';
const TILE_OPTS = {
  attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>',
  subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  maxZoom: 20,
};

// Zone grid cell half-span in degrees (matches server SPREAD = 0.06)
const HALF_SPAN = 0.03;
const RISK_FILL_OPACITY = 0.32;
const RISK_STROKE_OPACITY = 0.55;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getWeatherEmoji(description = '', temp = 30) {
  const d = description.toLowerCase();
  if (d.includes('rain') || d.includes('drizzle')) return '🌧️';
  if (d.includes('storm') || d.includes('thunder')) return '⛈️';
  if (d.includes('cloud')) return '⛅';
  if (d.includes('fog') || d.includes('mist') || d.includes('haze')) return '🌫️';
  if (d.includes('snow')) return '❄️';
  if (d.includes('clear') || d.includes('sunny')) return temp > 33 ? '☀️' : '🌤️';
  return temp > 35 ? '🌡️' : '🌤️';
}

function buildPopupHTML(data, isLoading) {
  if (isLoading) {
    return `
      <div class="temp-popup-inner">
        <div class="temp-popup-loading">
          <div class="temp-popup-spinner"></div>
          <span>Fetching temperature…</span>
        </div>
      </div>`;
  }
  if (data.error) {
    return `
      <div class="temp-popup-inner">
        <div class="temp-popup-error">⚠️ ${data.error}</div>
      </div>`;
  }

  const emoji = getWeatherEmoji(data.description, data.temp);
  const riskObj = getRisk(data.temp);
  const coordStr = `${Math.abs(data.lat).toFixed(4)}°${data.lat >= 0 ? 'N' : 'S'}, ${Math.abs(data.lng).toFixed(4)}°${data.lng >= 0 ? 'E' : 'W'}`;
  const locationStr =
    data.locationName && !['Unknown location', 'Unknown'].includes(data.locationName)
      ? `${data.locationName}${data.country ? ', ' + data.country : ''}`
      : coordStr;

  return `
    <div class="temp-popup-inner">
      <div class="temp-popup-header">
        <div class="temp-popup-location">${locationStr}</div>
        <div class="temp-popup-coords">${coordStr}</div>
        ${data.realtime
          ? '<div class="temp-popup-live">● Live</div>'
          : '<div class="temp-popup-estimated">★ Estimated (no OWM key)</div>'}
      </div>
      <div class="temp-popup-main">
        <span class="temp-popup-emoji">${emoji}</span>
        <span class="temp-popup-temp" style="color:${riskObj.color}">${data.temp}°C</span>
        <span class="temp-popup-risk" style="color:${riskObj.color}">${riskObj.label}</span>
      </div>
      <div class="temp-popup-desc">${data.description}</div>
      <div class="temp-popup-stats">
        <div class="temp-stat">
          <span class="temp-stat-label">Feels Like</span>
          <span class="temp-stat-value">${data.feelsLike}°C</span>
        </div>
        <div class="temp-stat">
          <span class="temp-stat-label">Humidity</span>
          <span class="temp-stat-value">${data.humidity}%</span>
        </div>
        <div class="temp-stat">
          <span class="temp-stat-label">Wind</span>
          <span class="temp-stat-value">${data.windSpeed} km/h</span>
        </div>
      </div>
    </div>`;
}

// Interpolate temp/aqi/greenCover at cursor position using inverse-distance weighting
function getInterpolatedData(lat, lng, zones) {
  if (!zones || zones.length === 0) return null;
  let totalWeight = 0, tempSum = 0, aqiSum = 0, greenCoverSum = 0;
  zones.forEach((z) => {
    const distSq = (z.lat - lat) ** 2 + (z.lng - lng) ** 2;
    const w = 1 / (distSq + 0.000001);
    totalWeight += w;
    tempSum += z.temp * w;
    aqiSum += z.aqi * w;
    greenCoverSum += z.greenCover * w;
  });
  return {
    temp: (tempSum / totalWeight).toFixed(1),
    aqi: Math.round(aqiSum / totalWeight),
    greenCover: Math.round(greenCoverSum / totalWeight),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MapView({ center, zoom, zones, afterMode, onZoneClick, selectedZone, onMapClick, activeTab }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const zoneLayersRef = useRef([]);
  const clickPopupRef = useRef(null);
  const clickMarkerRef = useRef(null);

  // Keep refs in sync so map event handlers always read fresh values
  const onMapClickRef = useRef(onMapClick);
  const zonesRef = useRef(zones);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { zonesRef.current = zones; }, [zones]);

  // Hover interpolation state (teammate feature)
  const [hoverData, setHoverData] = useState(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // ── Map initialisation ────────────────────────────────────────────────────
  useEffect(() => {
    if (mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
    });

    L.tileLayer(TILE_URL, TILE_OPTS).addTo(map);
    mapInstanceRef.current = map;

    // Click-anywhere: show OWM temperature popup card AND call onMapClick for sidebar
    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;

      // Always notify App.jsx (sidebar pin zone update)
      if (onMapClickRef.current) {
        onMapClickRef.current(lat, lng);
      }

      // Always show the OWM temperature popup card with accurate Nominatim location
      if (clickMarkerRef.current) { map.removeLayer(clickMarkerRef.current); clickMarkerRef.current = null; }
      if (clickPopupRef.current) { map.removeLayer(clickPopupRef.current); clickPopupRef.current = null; }

      const pinIcon = L.divIcon({
        className: '',
        html: `<div class="click-pin-icon">📍</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      clickMarkerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map);

      const popup = L.popup({
        className: 'temp-popup-wrapper',
        closeButton: true,
        autoClose: false,
        closeOnClick: false,
        maxWidth: 290,
        offset: [0, -10],
      })
        .setLatLng([lat, lng])
        .setContent(buildPopupHTML(null, true))
        .addTo(map);
      clickPopupRef.current = popup;

      try {
        const resp = await fetch(`http://localhost:5000/api/temperature?lat=${lat}&lng=${lng}`);
        const data = await resp.json();
        if (clickPopupRef.current) clickPopupRef.current.setContent(buildPopupHTML(data, false));
      } catch {
        if (clickPopupRef.current) clickPopupRef.current.setContent(buildPopupHTML({ error: 'Could not fetch temperature' }, false));
      }

      popup.on('remove', () => {
        if (clickMarkerRef.current) { map.removeLayer(clickMarkerRef.current); clickMarkerRef.current = null; }
        clickPopupRef.current = null;
      });
    });

    // Hover: show live interpolated data tooltip (teammate feature)
    map.on('mousemove', (e) => {
      if (!zonesRef.current || zonesRef.current.length === 0) return;
      const data = getInterpolatedData(e.latlng.lat, e.latlng.lng, zonesRef.current.filter(z => !z.isCustomPin));
      setHoverData(data);
      setCursorPos({ x: e.originalEvent.clientX, y: e.originalEvent.clientY });
    });
    map.on('mouseout', () => setHoverData(null));

    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  // ── Pan/zoom when city changes ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center, zoom]);

  // ── Render zones ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old layers
    zoneLayersRef.current.forEach((l) => map.removeLayer(l));
    zoneLayersRef.current = [];

    if (!zones.length) return;

    zones.forEach((zone) => {
      const temp = afterMode ? +(zone.temp * 0.82).toFixed(1) : zone.temp;
      const risk = getRisk(temp);
      const isSelected = selectedZone && selectedZone.id === zone.id;

      if (!selectedZone || !selectedZone.isCustomPin) {
         if (clickPopupRef.current) {
            map.removeLayer(clickPopupRef.current);
            clickPopupRef.current = null;
         }
         if (clickMarkerRef.current) {
            map.removeLayer(clickMarkerRef.current);
            clickMarkerRef.current = null;
         }
      }

      if (zone.isCustomPin) {
        // ── Teammate's custom SVG pin marker for dropped pins ────────────────
        const pinHtml = `
          <div style="position:relative;width:34px;height:34px;">
            <svg viewBox="0 0 24 24" fill="${risk.color}" stroke="#101827" stroke-width="1.5"
                 style="width:34px;height:34px;filter:drop-shadow(0px 4px 4px rgba(0,0,0,0.5));">
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>`;

        const customIcon = L.divIcon({
          html: pinHtml,
          className: 'custom-pin-icon',
          iconSize: [34, 34],
          iconAnchor: [17, 32],
          tooltipAnchor: [17, -16],
        });

        const marker = L.marker([zone.lat, zone.lng], { icon: customIcon }).addTo(map);

        marker.bindTooltip(
          `<strong>📍 ${zone.name}</strong><br/>
           🌡 ${temp}°C &nbsp; AQI: ${zone.aqi} &nbsp; 🌿 ${zone.greenCover}%`,
          { className: 'zone-tooltip', direction: 'top', offset: [0, -8] }
        );

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onZoneClick(zone);
        });

        zoneLayersRef.current.push(marker);

      } else if (activeTab === 'overview' || isSelected) {
        // ── Our colored rectangle for regular grid zones ──────────────────────
        const bounds = [
          [zone.lat - HALF_SPAN, zone.lng - HALF_SPAN],
          [zone.lat + HALF_SPAN, zone.lng + HALF_SPAN],
        ];

        const rect = L.rectangle(bounds, {
          color: risk.color,
          weight: isSelected ? 2.5 : 1,
          opacity: isSelected ? 0.95 : RISK_STROKE_OPACITY,
          fillColor: risk.color,
          fillOpacity: isSelected ? 0.5 : RISK_FILL_OPACITY,
          interactive: true,
        }).addTo(map);

        rect.on('mouseover', () => rect.setStyle({ fillOpacity: 0.55, weight: 2, opacity: 0.9 }));
        rect.on('mouseout', () => rect.setStyle({
          fillOpacity: isSelected ? 0.5 : RISK_FILL_OPACITY,
          weight: isSelected ? 2.5 : 1,
          opacity: isSelected ? 0.95 : RISK_STROKE_OPACITY,
        }));

        rect.bindTooltip(
          `<strong>${zone.name}</strong><br/>${temp}°C — ${risk.label}`,
          { className: 'zone-tooltip', direction: 'top', sticky: true }
        );

        rect.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onZoneClick(zone);
        });

        zoneLayersRef.current.push(rect);
      }
    });
  }, [zones, afterMode, selectedZone, activeTab]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div ref={mapRef} className="map-container" id="heatmap" />

      {/* Teammate's hover interpolation tooltip — only shows when a city is loaded */}
      {hoverData && (
        <div style={{
          position: 'fixed',
          left: cursorPos.x + 16,
          top: cursorPos.y + 16,
          background: 'rgba(15, 20, 30, 0.88)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#e6edf3',
          padding: '10px 14px',
          borderRadius: '10px',
          zIndex: 9999,
          pointerEvents: 'none',
          fontSize: '12px',
          lineHeight: '1.7',
          boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          fontFamily: 'var(--font-mono)',
          minWidth: '160px',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7d8590' }}>
            Interpolated Heat Data
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
            <span style={{ color:'#7d8590' }}>Temp</span>
            <span style={{ fontWeight:600, color:'#d29922' }}>{hoverData.temp}°C</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
            <span style={{ color:'#7d8590' }}>AQI</span>
            <span style={{ fontWeight:600, color: hoverData.aqi > 150 ? '#f85149' : hoverData.aqi > 100 ? '#d29922' : '#3fb950' }}>{hoverData.aqi}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
            <span style={{ color:'#7d8590' }}>Green Cover</span>
            <span style={{ fontWeight:600, color:'#3fb950' }}>{hoverData.greenCover}%</span>
          </div>
          <div style={{ fontSize:10, color:'#555f6e', marginTop:6, textAlign:'center', fontStyle:'italic' }}>
            Click to drop a pin
          </div>
        </div>
      )}
    </>
  );
}
