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
  const [userLocation, setUserLocation] = useState(null);
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);

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
      setZoom(13);
      
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

  // Initial Location & Data Load
  React.useEffect(() => {
    let watchId;
    let initialLoadDone = false;

    if (!navigator.geolocation) {
      setLocationPromptOpen(true);
      handleSearch('Mumbai');
      return;
    }

    watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });

        if (!initialLoadDone) {
          initialLoadDone = true;
          // Reverse geocode to get city name
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`, {
              headers: { 'User-Agent': 'HeatGuard-Local-App' }
            });
            const data = await res.json();
            const city = data.address?.city || data.address?.town || data.address?.county || data.address?.state_district || 'Mumbai';
            handleSearch(city);
          } catch (err) {
            console.error("Reverse geocoding failed", err);
            handleSearch('Mumbai');
          }
        }
      },
      (error) => {
        console.error("Location error:", error);
        setLocationPromptOpen(true);
        if (!initialLoadDone) {
          initialLoadDone = true;
          handleSearch('Mumbai'); // fallback
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
    );

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
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

  const handleLocateMe = useCallback(() => {
    if (userLocation) {
      // Create a new object reference so the MapView useEffect always triggers
      setCenter({ lat: userLocation.lat, lng: userLocation.lng });
      setZoom(prev => prev === 14 ? 14.0001 : 14); // Toggle slightly to force zoom re-render if needed
    } else {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setCenter({ lat: latitude, lng: longitude });
          setZoom(14);
          setLoading(false);
          setLocationPromptOpen(false);
        },
        (error) => {
          console.error("Locate Me manual fetch error:", error);
          setLoading(false);
          setLocationPromptOpen(true);
        },
        { enableHighAccuracy: true, timeout: 30000 }
      );
    }
  }, [userLocation]);

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
          userLocation={userLocation}
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
      <BottomBar afterMode={afterMode} onToggle={setAfterMode} lastUpdated={lastUpdated} onLocateMe={handleLocateMe} />
      <AuthModal />
      {locationPromptOpen && (
        <div className="location-modal-overlay">
          <div className="location-modal">
            <h3 style={{ marginBottom: "10px", color: "var(--accent)" }}>Location Access Required</h3>
            <p style={{ marginBottom: "15px", fontSize: "14px", lineHeight: "1.5" }}>
              Please enable location services on your device and browser to use live tracking and view your local climate risks.
            </p>
            <button className="btn" onClick={() => setLocationPromptOpen(false)}>
              Continue without location
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
