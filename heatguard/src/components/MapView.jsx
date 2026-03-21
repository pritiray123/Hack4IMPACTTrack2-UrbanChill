import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import { getRisk } from '../utils/riskHelpers';

const TILE_URL = 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
const TILE_OPTS = {
  attribution: '&copy; Google Maps',
  subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
  maxZoom: 20,
};

const HEAT_GRADIENT = { 0.2: '#1a472a', 0.4: '#d29922', 0.65: '#f85149', 1.0: '#ff006e' };

export default function MapView({ center, zoom, zones, afterMode, onZoneClick, selectedZone, onMapClick }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const heatLayerRef = useRef(null);
  const markersRef = useRef([]);
  const prevZonesRef = useRef([]);
  const onMapClickRef = useRef(onMapClick);
  const zonesRef = useRef(zones);

  const [hoverData, setHoverData] = useState(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);
  
  const getInterpolatedData = (lat, lng, currentZones) => {
    if (!currentZones || currentZones.length === 0) return null;
    let totalWeight = 0;
    let tempSum = 0, aqiSum = 0, greenCoverSum = 0;
    
    currentZones.forEach(z => {
      const distSq = Math.pow(z.lat - lat, 2) + Math.pow(z.lng - lng, 2);
      const weight = 1 / (distSq + 0.000001); // Prevent div by zero
      totalWeight += weight;
      tempSum += z.temp * weight;
      aqiSum += z.aqi * weight;
      greenCoverSum += z.greenCover * weight;
    });

    return {
      temp: (tempSum / totalWeight).toFixed(1),
      aqi: Math.round(aqiSum / totalWeight),
      greenCover: Math.round(greenCoverSum / totalWeight)
    };
  };

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

    map.on('click', (e) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.latlng.lat, e.latlng.lng);
      }
    });

    map.on('mousemove', (e) => {
      if (!zonesRef.current || zonesRef.current.length === 0) return;
      const data = getInterpolatedData(e.latlng.lat, e.latlng.lng, zonesRef.current);
      setHoverData(data);
      setCursorPos({ x: e.originalEvent.clientX, y: e.originalEvent.clientY });
    });

    map.on('mouseout', () => {
      setHoverData(null);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update view when center/zoom changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center, zoom]);

  // Update heatmap and markers when zones or afterMode changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !zones.length) return;

    // Clear old layers
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
    }
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    // Build heat data
    const heatData = zones.map((z) => {
      const temp = afterMode ? +(z.temp * 0.82).toFixed(1) : z.temp;
      const intensity = Math.min(Math.max((temp - 25) / 20, 0), 1);
      return [z.lat, z.lng, intensity];
    });

    // Add heat layer
    heatLayerRef.current = L.heatLayer(heatData, {
      radius: 45,
      blur: 30,
      maxZoom: 15,
      gradient: HEAT_GRADIENT,
    }).addTo(map);

    // Create a map for fast lookup of previous zones
    const prevZonesMap = new Map();
    prevZonesRef.current.forEach(z => prevZonesMap.set(z.id, z));

    // Add circle markers only for custom dropped pins
    zones.forEach((zone) => {
      if (!zone.isCustomPin) return;

      const temp = afterMode ? +(zone.temp * 0.82).toFixed(1) : zone.temp;
      const risk = getRisk(temp);
      const isSelected = selectedZone && selectedZone.id === zone.id;

      // Check if risk worsened compared to last fetch
      let isRiskElevated = false;
      const prevZone = prevZonesMap.get(zone.id);
      if (prevZone) {
        const prevRisk = getRisk(prevZone.temp);
        // Assuming higher temp implies higher risk, if it jumps to a new bracket
        isRiskElevated = (temp > prevZone.temp) && (risk.label !== prevRisk.label) && ['HIGH', 'CRITICAL'].includes(risk.label);
      }

      const pinHtml = `
        <div style="position: relative; width: 34px; height: 34px;">
          <svg viewBox="0 0 24 24" fill="${risk.color}" stroke="#101827" stroke-width="1.5" style="width: 34px; height: 34px; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.5));">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
        </div>
      `;

      const customIcon = L.divIcon({
        html: pinHtml,
        className: 'custom-pin-icon',
        iconSize: [34, 34],
        iconAnchor: [17, 32],
        tooltipAnchor: [17, -16]
      });

      const marker = L.marker([zone.lat, zone.lng], { icon: customIcon }).addTo(map);

      // Static Board Content
      const boardContent = `
        <div style="min-width: 140px; padding: 2px;">
          <div style="font-weight: bold; font-size: 14px; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 4px;">
            📍 ${zone.name}
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 3px;">
            <span style="color: #a1a1aa;">Temp:</span>
            <span style="color: var(--warn); font-weight: bold;">${temp}°C</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 3px;">
            <span style="color: #a1a1aa;">AQI:</span>
            <span style="color: var(--danger); font-weight: bold;">${zone.aqi}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13px;">
            <span style="color: #a1a1aa;">Greenery:</span>
            <span style="color: var(--accent); font-weight: bold;">${zone.greenCover}%</span>
          </div>
        </div>
      `;

      marker.bindTooltip(boardContent, {
        permanent: true,
        direction: 'right',
        offset: [12, -6],
        className: 'dark-tooltip',
        interactive: true
      });

      marker.on('click', () => onZoneClick(zone));
      markersRef.current.push(marker);
    });

    // Save current zones for next compare
    prevZonesRef.current = zones;

  }, [zones, afterMode, selectedZone]);

  return (
    <>
      <div ref={mapRef} className="map-container" id="heatmap" />
      {hoverData && (
        <div style={{
          position: 'fixed',
          left: cursorPos.x + 15,
          top: cursorPos.y + 15,
          backgroundColor: 'rgba(20, 25, 35, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#e6edf3',
          padding: '10px 12px',
          borderRadius: '8px',
          zIndex: 9999,
          pointerEvents: 'none',
          fontSize: '13px',
          lineHeight: '1.6',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
            Live Interpolated Data
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Temp:</span>
            <span style={{ fontWeight: 'bold', color: 'var(--warn)' }}>{hoverData.temp}°C</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
            <span style={{ color: 'var(--text-muted)' }}>AQI:</span>
            <span style={{ fontWeight: 'bold', color: 'var(--danger)' }}>{hoverData.aqi}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Green Cover:</span>
            <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{hoverData.greenCover}%</span>
          </div>
          <div style={{ fontSize: '10.5px', color: '#8b949e', marginTop: '6px', fontStyle: 'italic', textAlign: 'center' }}>
            Click anywhere to drop a pin
          </div>
        </div>
      )}
    </>
  );
}
