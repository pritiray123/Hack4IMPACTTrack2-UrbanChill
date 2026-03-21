import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import { getRisk } from '../utils/riskHelpers';

// Google Maps-style road tiles
const TILE_URL = 'https://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}';
const TILE_OPTS = {
  attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>',
  maxZoom: 20,
  subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
};

// Zone grid cell half-span in degrees (matches server SPREAD = 0.06)
const HALF_SPAN = 0.03;

// Risk colour with opacity levels for zone rectangles
const RISK_FILL_OPACITY = 0.32;
const RISK_STROKE_OPACITY = 0.55;

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
  const locationStr = data.locationName && data.locationName !== 'Unknown location' && data.locationName !== 'Unknown'
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

export default function MapView({ center, zoom, zones, afterMode, onZoneClick, selectedZone }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const zoneLayersRef = useRef([]);
  const clickPopupRef = useRef(null);
  const clickMarkerRef = useRef(null);

  // Initialize map
  useEffect(() => {
    if (mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
    });

    L.tileLayer(TILE_URL, TILE_OPTS).addTo(map);
    mapInstanceRef.current = map;

    // Click-anywhere handler for temperature popup
    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;

      // If the click came from a zone rectangle, let it be handled there
      if (e.originalEvent._zoneClick) return;

      // Remove old pin + popup
      if (clickMarkerRef.current) { map.removeLayer(clickMarkerRef.current); clickMarkerRef.current = null; }
      if (clickPopupRef.current) { map.removeLayer(clickPopupRef.current); clickPopupRef.current = null; }

      // Drop a 📍 pin
      const pinIcon = L.divIcon({
        className: '',
        html: `<div class="click-pin-icon">📍</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      clickMarkerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map);

      // Show loading popup
      const popup = L.popup({
        className: 'temp-popup-wrapper',
        closeButton: true,
        autoClose: false,
        closeOnClick: false,
        maxWidth: 280,
        offset: [0, -10],
      })
        .setLatLng([lat, lng])
        .setContent(buildPopupHTML(null, true))
        .addTo(map);

      clickPopupRef.current = popup;

      // Fetch real-time temperature
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

    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  // Update view when city changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center, zoom]);

  // Render zone rectangles whenever zones/afterMode/selectedZone change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old zone layers
    zoneLayersRef.current.forEach((l) => map.removeLayer(l));
    zoneLayersRef.current = [];

    if (!zones.length) return;

    zones.forEach((zone) => {
      const temp = afterMode ? +(zone.temp * 0.82).toFixed(1) : zone.temp;
      const risk = getRisk(temp);
      const isSelected = selectedZone && selectedZone.id === zone.id;

      // Rectangle bounds: zone lat/lng is center, span is HALF_SPAN in each direction
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
        dashArray: isSelected ? null : null,
        interactive: true,
      }).addTo(map);

      // Highlight on hover
      rect.on('mouseover', () => {
        rect.setStyle({ fillOpacity: 0.55, weight: 2, opacity: 0.9 });
      });
      rect.on('mouseout', () => {
        rect.setStyle({
          fillOpacity: isSelected ? 0.5 : RISK_FILL_OPACITY,
          weight: isSelected ? 2.5 : 1,
          opacity: isSelected ? 0.95 : RISK_STROKE_OPACITY,
        });
      });

      // Tooltip
      rect.bindTooltip(
        `<strong>${zone.name}</strong><br/>${temp}°C — ${risk.label}`,
        { className: 'zone-tooltip', direction: 'top', sticky: true }
      );

      // Click fires zone detail
      rect.on('click', (e) => {
        e.originalEvent._zoneClick = true;
        onZoneClick(zone);
      });

      zoneLayersRef.current.push(rect);
    });
  }, [zones, afterMode, selectedZone]);

  return <div ref={mapRef} className="map-container" id="heatmap" />;
}
