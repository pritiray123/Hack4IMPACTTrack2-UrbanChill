import React, { useState, useCallback } from 'react';
import TopBar from './components/TopBar';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import BottomBar from './components/BottomBar';
import AuthModal from './components/AuthModal';
import { resolveCity } from './utils/cityConfigs';
import { generateZones } from './utils/generateZones';
import { getRisk } from './utils/riskHelpers';
import { getRecommendations } from './utils/claudeAPI';
import { LanguageContext } from './context/LanguageContext';

export default function App() {
  const [cityName, setCityName] = useState('');
  const [center, setCenter] = useState({ lat: 19.076, lng: 72.8777 });
  const [zoom, setZoom] = useState(12);
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [afterMode, setAfterMode] = useState(false);
  const [activeTab, setActiveTab] = useState('zone');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const { lang } = React.useContext(LanguageContext) || { lang: 'en' };
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchCityData = useCallback(async (query) => {
    try {
      const res = await fetch(`http://localhost:5000/api/city/${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Failed to load location data from server.');
      const data = await res.json();
      
      const newZones = data.zones;
      const config = data.config;
      
      setCityName(config.name);
      setCenter({ lat: config.lat, lng: config.lng });
      setZoom(config.zoom || 12);
      
      setZones(newZones);
      setLastUpdated(new Date());

      // Compute stats
      const temps = newZones.map((z) => z.temp);
      const avgTemp = (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
      const maxTemp = Math.max(...temps).toFixed(1);
      const atRiskZones = temps.filter((t) => t >= 36).length;
      const avgGreenCover = (
        newZones.reduce((a, z) => a + z.greenCover, 0) / newZones.length
      ).toFixed(1);

      setStats({ avgTemp, maxTemp, atRiskZones, avgGreenCover });
      return true;
    } catch (err) {
      console.error(err);
      alert(`Could not pinpoint data for: "${query}". Try adding more details like "City, Country".`);
      return false;
    }
  }, []);

  const handleSearch = useCallback(async (input) => {
    if (!input || !input.trim()) return;
    
    setLoading(true);
    setSelectedZone(null);
    setRecommendations(null);
    setAfterMode(false);

    await fetchCityData(input.trim());
    setLoading(false);
  }, [fetchCityData]);

  // Initial Data Load
  React.useEffect(() => {
    handleSearch('Mumbai');
  }, [handleSearch]);

  // Polling Effect
  React.useEffect(() => {
    if (!cityName) return;

    // Poll every 5 minutes (300000 ms)
    const intervalId = setInterval(() => {
      fetchCityData(cityName);
    }, 300000);

    return () => clearInterval(intervalId);
  }, [cityName, fetchCityData]);

  const handleZoneClick = useCallback(async (zone) => {
    setSelectedZone(zone);
    setActiveTab('zone');
    setRecLoading(true);
    setRecommendations(null);

    try {
      const recs = await getRecommendations(zone, lang);
      setRecommendations(recs);
    } catch {
      // fallback handled in claudeAPI.js
    } finally {
      setRecLoading(false);
    }
  }, []);

  const handleZoneSelectFromOverview = useCallback((zone) => {
    setSelectedZone(zone);
    setActiveTab('zone');
    handleZoneClick(zone);
  }, [handleZoneClick]);

  const handleMapClick = useCallback(async (lat, lng) => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:5000/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng })
      });
      if (!res.ok) throw new Error('Failed to create pin');
      const pinZone = await res.json();
      
      setZones(prev => {
        const withoutOldPins = prev.filter(z => !z.isCustomPin);
        return [...withoutOldPins, pinZone];
      });
      
      handleZoneClick(pinZone);
    } catch (err) {
      console.error(err);
      alert('Could not fetch real weather for this pin.');
    } finally {
      setLoading(false);
    }
  }, [handleZoneClick]);

  return (
    <div className="app-layout">
      <TopBar onSearch={handleSearch} stats={stats} loading={loading} />
      <div className="main-area">
        <MapView
          center={center}
          zoom={zoom}
          zones={zones}
          afterMode={afterMode}
          onZoneClick={handleZoneClick}
          selectedZone={selectedZone}
          onMapClick={handleMapClick}
        />
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          selectedZone={selectedZone}
          recommendations={recommendations}
          recLoading={recLoading}
          zones={zones}
          cityName={cityName}
          onZoneSelect={handleZoneSelectFromOverview}
          afterMode={afterMode}
        />
      </div>
      <BottomBar afterMode={afterMode} onToggle={setAfterMode} lastUpdated={lastUpdated} />
      <AuthModal />
    </div>
  );
}
