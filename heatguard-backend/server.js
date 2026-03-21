const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)));
const { initDB, getDB } = require('./db');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

app.use(cors());
app.use(express.json());

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- HEALTH CHECK ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date(), uptime: process.uptime() });
});

// --- AUTHENTICATION ENDPOINTS ---

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db = getDB();
    const existing = await db.get(`SELECT id FROM users WHERE email = ?`, [email]);
    if (existing) return res.status(400).json({ error: 'Email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const result = await db.run(`INSERT INTO users (email, password_hash) VALUES (?, ?)`, [email, hash]);

    const token = jwt.sign({ id: result.lastID, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: result.lastID, email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db = getDB();
    const user = await db.get(`SELECT * FROM users WHERE email = ?`, [email]);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- CLAUDE PROXY ENDPOINT ---

function getDetailedMockRecommendations(zone, risk) {
  // Generate a pseudo-random seed based on zone properties to ensure variation but consistency per zone
  const seed = zone.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + Math.floor(zone.temp) + zone.aqi + zone.greenCover;
  
  const pseudoRand = (n) => {
    const x = Math.sin(seed * 9301 + n * 49297) * 10000;
    return x - Math.floor(x);
  };

  const reductionMap = {
    LOW: `−${(1.0 + pseudoRand(1) * 0.8).toFixed(1)}°C`,
    MODERATE: `−${(2.0 + pseudoRand(2) * 1.5).toFixed(1)}°C`,
    HIGH: `−${(3.5 + pseudoRand(3) * 1.5).toFixed(1)}°C`,
    CRITICAL: `−${(4.5 + pseudoRand(4) * 2.0).toFixed(1)}°C`,
  };

  let allInterventions = [];

  // 1. Temperature-based Interventions
  if (zone.temp > 38) {
    allInterventions.push({
      type: "WATER FEATURE",
      action: `Install high-efficiency evaporative misting systems at ${Math.floor(2 + pseudoRand(5)*5)} major public squares in ${zone.name} to combat the extreme ${zone.temp}°C heat.`,
      impact: `−2.5°C localised cooling during peak afternoon hours.`
    });
    allInterventions.push({
      type: "COOL PAVEMENT",
      action: `Apply solar-reflective coatings on ${Math.floor(15 + pseudoRand(6)*25)}% of exposed asphalt roads in the ${zone.landUse.toLowerCase()} sectors.`,
      impact: `Reduces surface temperature by up to 5°C, lowering ambient heat.`
    });
  } else {
    allInterventions.push({
      type: "COOL PAVEMENT",
      action: `Retrofit pedestrian walkways in ${zone.name} with light-coloured, permeable paving to reduce surface heat retention.`,
      impact: `−0.8°C local temp, 25% reduction in surface heat retention.`
    });
  }

  // 2. AQI & Pollution-based Interventions
  if (zone.aqi > 150) {
    allInterventions.push({
      type: "GREEN WALL",
      action: `Construct vertical moss and ivy green walls on ${Math.floor(5 + pseudoRand(7)*10)} major ${zone.landUse.toLowerCase()} buildings to filter out PM2.5 from the severe ${zone.aqi} AQI air.`,
      impact: `Absorbs 30% of local particulate matter, −1.5°C facade temp.`
    });
    allInterventions.push({
      type: "TREES",
      action: `Plant a dense buffer belt of ${Math.floor(150 + pseudoRand(8)*250)} native pollution-absorbing trees (like Neem and Peepal) along high-traffic corridors.`,
      impact: `Improves respiratory health for ${Math.round(zone.density * 0.15).toLocaleString()} nearby residents.`
    });
  } else {
    allInterventions.push({
      type: "TREES",
      action: `Increase canopy density by planting ${Math.floor(50 + pseudoRand(9)*100)} large-canopy native shade trees scattered across ${zone.name}.`,
      impact: `−1.2°C avg temp under canopy, improves local biodiversity.`
    });
  }

  // 3. Green Cover-based Interventions
  if (zone.greenCover < 15) {
    allInterventions.push({
      type: "ROOFTOP GARDEN",
      action: `Mandate the conversion of 40% of flat concrete roofs in this low-vegetation zone (only ${zone.greenCover}% green cover) to drought-resistant green roofs.`,
      impact: `−1.2°C building surface temp, drastically reduces urban runoff.`
    });
    allInterventions.push({
      type: "PARK",
      action: `Reclaim abandoned plots to develop ${Math.floor(1 + pseudoRand(10)*3)} pocket parks with native shrubs at the centre of ${zone.name}.`,
      impact: `−2.0°C within 300m radius, creating vital green corridors.`
    });
  } else {
    allInterventions.push({
      type: "WATER FEATURE",
      action: `Add seasonal water bodies and shaded resting pavilions throughout the existing green spaces in ${zone.name}.`,
      impact: `−1.5°C ambient temp around the water bodies.`
    });
  }

  // Mix LandUse-specific Items
  if (zone.landUse === 'Industrial') {
    allInterventions.push({
      type: "ROOFTOP GARDEN",
      action: `Deploy solar-green hybrid roofs combining PV panels and sedum vegetation over massive industrial sheds in ${zone.name}.`,
      impact: `Generates renewable energy while providing −1.0°C surface cooling.`
    });
  } else if (zone.landUse === 'Residential') {
     allInterventions.push({
      type: "TREES",
      action: `Distribute ${Math.floor(500 + pseudoRand(13)*300)} native saplings to households in ${zone.name} to plant in private courtyards and along residential streets.`,
      impact: `Fosters community ownership, −1.5°C ambient cooling at block level.`
    });
  }

  // Safely random-sort the accumulated interventions using our pseudo-random generator
  // This ensures the same zone gets the same interventions each time, but different zones get different mixes
  const shuffled = allInterventions.sort((a, b) => pseudoRand(a.type.charCodeAt(0)) - 0.5);
  const selectedInterventions = shuffled.slice(0, 3);

  const priorityLevel = risk.label === "LOW" ? "LOW" : risk.label === "MODERATE" ? "MEDIUM" : "HIGH";

  return {
    interventions: selectedInterventions,
    summary: `${zone.name} is facing ${risk.label.toLowerCase()} heat stress, exacerbated by its current weather profile (${zone.temp}°C, AQI: ${zone.aqi}). Given its status as a ${zone.landUse} area with ${zone.greenCover}% green cover, the most urgent priority is deploying ${selectedInterventions[0].type.toLowerCase()} to provide immediate climatic relief to the community.`,
    projected_temp_reduction: reductionMap[risk.label] || "−2.5°C",
    priority: priorityLevel,
    residents_benefited: Math.round(zone.density * (0.1 + pseudoRand(12)*0.2)),
  };
}

app.post('/api/analyse-zone', async (req, res) => {
  try {
    const { zone, risk, language } = req.body;
    let userId = null;

    // Optional authentication check for Guest Mode support
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      try {
        const user = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
        userId = user.id;
      } catch (e) {
        // Ignored, fallback to guest
      }
    }

    if (!zone || !risk) {
      return res.status(400).json({ error: 'Zone and risk data required' });
    }

    const langMap = { hi: 'Hindi', ta: 'Tamil', te: 'Telugu', en: 'English' };
    const langName = language ? (langMap[language] || 'English') : 'English';
    const languageInstruction = language && language !== 'en' ? ` IMPORTANT SYSTEM INSTRUCTION: You MUST directly translate every single JSON string value (especially 'action', 'impact', 'summary', and 'projected_temp_reduction') into fluent and natural ${langName}. Do NOT provide the values lightly translated or in English. Ensure the JSON keys remain exactly as requested in English, but the output text MUST be fully localized in the requested language (${langName}).` : '';

    const prompt = `You are an urban climate expert. Analyse this urban zone and give 3 specific green infrastructure interventions.${languageInstruction}\n\nZone data:\n- Name: ${zone.name}\n- Land use: ${zone.landUse}\n- Surface temperature: ${zone.temp}°C\n- Green cover: ${zone.greenCover}%\n- Air Quality Index: ${zone.aqi}\n- Population density: ${zone.density} people/km²\n- Humidity: ${zone.humidity}%\n- Heat risk level: ${risk.label}\n\nRespond ONLY with a valid JSON object. No markdown, no explanation outside JSON:\n{\n  "interventions": [\n    {\n      "type": "TREES" | "COOL PAVEMENT" | "ROOFTOP GARDEN" | "GREEN WALL" | "WATER FEATURE" | "PARK",\n      "action": "specific actionable recommendation in one sentence",\n      "impact": "projected temperature reduction and benefit"\n    }\n  ],\n  "summary": "2-sentence overall assessment and most urgent priority",\n  "projected_temp_reduction": "e.g. −3.2°C with all interventions",\n  "priority": "HIGH" | "MEDIUM" | "LOW"\n}`;

    const geminiApiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
    
    // For local dev when NO API KEY is available, return mock data
    if (!geminiApiKey || geminiApiKey === 'your_gemini_api_key_here' || geminiApiKey === '') {
      const mockResult = getDetailedMockRecommendations(zone, risk);
      
      // Save Report only if logged in
      if (userId) {
        const db = getDB();
        await db.run(
          `INSERT INTO reports (user_id, zone_id, interventions_json, summary, projected_reduction) VALUES (?, ?, ?, ?, ?)`,
          [userId, zone.id, JSON.stringify(mockResult.interventions), mockResult.summary, mockResult.projected_temp_reduction]
        );
      }
      
      return res.json(mockResult);
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Gemini API Error:', errBody);
      throw new Error(`Gemini API Error: ${response.status} ${errBody}`);
    }

    const data = await response.json();
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error(`Unexpected Gemini Response format: ${JSON.stringify(data)}`);
    }

    const raw = data.candidates[0].content.parts[0].text;
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    // Save report to database only if logged in
    if (userId) {
      const db = getDB();
      await db.run(
        `INSERT INTO reports (user_id, zone_id, interventions_json, summary, projected_reduction) VALUES (?, ?, ?, ?, ?)`,
        [userId, zone.id, JSON.stringify(result.interventions), result.summary, result.projected_temp_reduction]
      );
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// --- CITY GRID AND WEATHER API ---
const CITY_CONFIGS = {
  mumbai:      { lat: 19.076,  lng: 72.8777, zoom: 12 },
  delhi:       { lat: 28.6139, lng: 77.2090, zoom: 12 },
  chennai:     { lat: 13.0827, lng: 80.2707, zoom: 12 },
  bangalore:   { lat: 12.9716, lng: 77.5946, zoom: 12 },
  hyderabad:   { lat: 17.3850, lng: 78.4867, zoom: 12 },
  kolkata:     { lat: 22.5726, lng: 88.3639, zoom: 12 },
  bhubaneswar: { lat: 20.2961, lng: 85.8245, zoom: 12 }
};

const CITY_ZONE_NAMES = {
  mumbai: [
    'Colaba', 'Fort', 'Marine Drive', 'Nariman Point', 'Malabar Hill',
    'Breach Candy', 'Worli', 'Lower Parel', 'Prabhadevi', 'Dadar',
    'Matunga', 'Sion', 'Bandra', 'Khar', 'Santacruz',
    'Vile Parle', 'Juhu', 'Andheri', 'Versova', 'Goregaon',
    'Malad', 'Kandivali', 'Borivali', 'Powai', 'Kurla'
  ],
  delhi: [
    'Connaught Place', 'Chanakyapuri', 'Vasant Vihar', 'Hauz Khas', 'Green Park',
    'Saket', 'Vasant Kunj', 'Greater Kailash', 'Lajpat Nagar', 'South Extension',
    'Defence Colony', 'Lodhi Road', 'Karol Bagh', 'Rajendra Nagar', 'Patel Nagar',
    'Rohini', 'Pitampura', 'Shalimar Bagh', 'Ashok Vihar', 'Kamla Nagar',
    'Dwarka', 'Janakpuri', 'Vikaspuri', 'Punjabi Bagh', 'Rajouri Garden'
  ],
  chennai: [
    'Parrys', 'George Town', 'Egmore', 'Vepery', 'Chetpet',
    'Nungambakkam', 'T Nagar', 'Alwarpet', 'Mylapore', 'Mandaveli',
    'Adyar', 'Besant Nagar', 'Thiruvanmiyur', 'Velachery', 'Guindy',
    'Saidapet', 'Ashok Nagar', 'KK Nagar', 'Vadapalani', 'Kodambakkam',
    'Anna Nagar', 'Kilpauk', 'Ayanavaram', 'Perambur', 'Tambaram'
  ],
  bangalore: [
    'MG Road', 'Brigade Road', 'Commercial Street', 'Shivajinagar', 'Vasanth Nagar',
    'Indiranagar', 'Domlur', 'Koramangala', 'HSR Layout', 'BTM Layout',
    'Jayanagar', 'JP Nagar', 'Banashankari', 'Basavanagudi', 'Chamrajpet',
    'Malleswaram', 'Rajajinagar', 'Yeshwanthpur', 'Hebbal', 'RT Nagar',
    'Whitefield', 'Marathahalli', 'Bellandur', 'Electronic City', 'Yelahanka'
  ],
  hyderabad: [
    'Charminar', 'Old City', 'Afzal Gunj', 'Koti', 'Abids',
    'Nampally', 'Lakdikapul', 'Khairatabad', 'Somajiguda', 'Punjagutta',
    'Banjara Hills', 'Jubilee Hills', 'Mehdipatnam', 'Toli Chowki', 'Attapur',
    'Madhapur', 'HITEC City', 'Kondapur', 'Gachibowli', 'Manikonda',
    'Kukatpally', 'Miyapur', 'Secunderabad', 'Begumpet', 'Tarnaka'
  ],
  kolkata: [
    'Dalhousie Square', 'Park Street', 'Esplanade', 'Ballygunge', 'Alipore',
    'Bhawanipore', 'Rashbehari', 'Gariahat', 'Jodhpur Park', 'Lake Town',
    'Salt Lake', 'New Town', 'Rajarhat', 'Dum Dum', 'Baguiati',
    'Shyambazar', 'Hatibagan', 'College Street', 'Sealdah', 'Entally',
    'Tollygunge', 'Jadavpur', 'Garia', 'Behala', 'Howrah'
  ],
  bhubaneswar: [
    'Chandrasekharpur', 'Patia', 'Nayapalli', 'Sahid Nagar', 'Khandagiri',
    'Jaydev Vihar', 'Janpath', 'Unit-1', 'Unit-2', 'Unit-3',
    'Unit-4', 'Unit-6', 'Bapuji Nagar', 'Satya Nagar', 'Baramunda',
    'Kalinga Nagar', 'Vani Vihar', 'Ravi Talkies', 'Old Town', 'Lingaraj',
    'Rasulgarh', 'Mancheswar', 'BJB Nagar', 'Acharya Vihar', 'Sainik School'
  ]
};

const LAND_USES = ['Residential', 'Commercial', 'Industrial', 'Mixed Use', 'Green Space'];
const GENERIC_ZONE_PREFIXES = [
  'Central', 'North', 'South', 'East', 'West',
  'Old Town', 'New Town', 'Cantonment', 'Lake', 'Market',
  'Station', 'Port', 'Garden', 'Tech Park', 'University',
  'Airport', 'River', 'Hill', 'Temple', 'Fort',
  'Mall', 'Bridge', 'Colony', 'Nagar', 'Bazaar'
];

function generateZones(cityKey, centerLat, centerLng, latSpan = 0.06, lngSpan = 0.06, dynamicNames = null, displayName = "") {
  const zones = [];
  const GRID = 5;
  const startLat = centerLat - (GRID / 2) * latSpan;
  const startLng = centerLng - (GRID / 2) * lngSpan;

  const seed = cityKey.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  
  // Use dynamically fetched local suburbs/villages if available, else padded generic names
  let cityNamesList = dynamicNames || CITY_ZONE_NAMES[cityKey] || GENERIC_ZONE_PREFIXES.map(p => `${displayName} ${p}`);


  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const idx = row * GRID + col;
      const pseudoRand = (n) => {
        const x = Math.sin(seed * 9301 + idx * 49297 + n * 233) * 10000;
        return x - Math.floor(x);
      };

      const lat = startLat + row * latSpan + (pseudoRand(1) - 0.5) * latSpan * 0.1;
      const lng = startLng + col * lngSpan + (pseudoRand(2) - 0.5) * lngSpan * 0.1;
      
      const greenCover = +(5 + pseudoRand(4) * 55).toFixed(1);
      const density = Math.round(3000 + pseudoRand(5) * 45000);
      const landUse = LAND_USES[Math.floor(pseudoRand(8) * LAND_USES.length)];
      
      const zoneName = cityNamesList[idx % cityNamesList.length];

      zones.push({
        id: `z_${cityKey}_${row}_${col}`,
        name: zoneName,
        lat,
        lng,
        latSpan,
        lngSpan,
        greenCover,
        density,
        landUse,
        temp: 25, // default fallback
        aqi: 50,  // default fallback
        humidity: 50 // default fallback
      });
    }
  }
  return zones;
}

app.get('/api/city/:name', async (req, res) => {
  try {
    const query = req.params.name.trim();
    
    // Geocode the query using Nominatim OpenStreetMap API
    // Added countrycodes=in to heavily bias results for Indian cities
    const geocodeRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=in&format=json&limit=1`, {
      headers: { 'User-Agent': 'HeatGuard-Local-App' } // Nominatim requires a user-agent
    });
    
    const geocodeData = await geocodeRes.json();
    
    if (!geocodeData || geocodeData.length === 0) {
      return res.status(404).json({ error: 'Location not found via Geocoding.' });
    }
    
    const lat = parseFloat(geocodeData[0].lat);
    const lng = parseFloat(geocodeData[0].lon);
    
    // Simplify name (e.g., "Pune, Maharashtra, India" -> "Pune")
    const fullDisplayName = geocodeData[0].display_name;
    const displayName = fullDisplayName.split(',')[0].trim();
    
    const config = {
      name: displayName,
      fullName: fullDisplayName,
      lat,
      lng,
      zoom: 12
    };

    let latSpan = 0.06;
    let lngSpan = 0.06;
    let localNames = null;

    if (geocodeData[0].boundingbox) {
      const bbox = geocodeData[0].boundingbox.map(parseFloat);
      // bbox: [latMin, latMax, lonMin, lonMax]
      const totalLat = Math.abs(bbox[1] - bbox[0]);
      const totalLng = Math.abs(bbox[3] - bbox[2]);
      
      // Limit to reasonable spans (between 0.005 and 0.12 degrees per cell)
      latSpan = Math.max(0.005, Math.min(0.12, totalLat / 5));
      lngSpan = Math.max(0.005, Math.min(0.12, totalLng / 5));

      // Attempt to fetch authentic local neighborhoods via Overpass API
      if (!CITY_ZONE_NAMES[displayName.toLowerCase()]) {
        try {
          const query = `[out:json][timeout:3];(node["place"~"suburb|town|village|hamlet|neighbourhood"](${bbox[0]},${bbox[2]},${bbox[1]},${bbox[3]}););out 30;`;
          const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
          
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000); // 3 sec timeout
          
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeout);
          
          if (res.ok) {
            const data = await res.json();
            if (data && data.elements) {
              let names = data.elements.map(e => e.tags?.name || e.tags?.['name:en']).filter(Boolean);
              names = [...new Set(names)]; // Remove exact duplicates
              if (names.length >= 5) {
                localNames = names;
              }
            }
          }
        } catch (err) {
          console.log(`Failed to fetch local names for ${displayName}:`, err.message);
        }
      }
    }

    // Generate grid coordinates
    const zones = generateZones(displayName.toLowerCase(), config.lat, config.lng, latSpan, lngSpan, localNames, displayName);
    const lats = zones.map(z => z.lat).join(',');
    const lngs = zones.map(z => z.lng).join(',');

    try {
      // Fetch real weather from OWM (if key set) or Open-Meteo as fallback
      const owmKey = process.env.OWM_API_KEY;
      if (owmKey) {
        // OWM allows up to 60 calls/min on free tier — fetch all 25 zones in parallel
        const owmResults = await Promise.all(
          zones.map(z =>
            fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${z.lat}&lon=${z.lng}&appid=${owmKey}&units=metric`)
              .then(r => r.ok ? r.json() : null)
              .catch(() => null)
          )
        );
        owmResults.forEach((data, i) => {
          if (data && data.main) {
            zones[i].temp = data.main.temp;
            zones[i].humidity = data.main.humidity;
          }
        });
      } else {
        // Open-Meteo batch fallback
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m&timezone=auto`);
        const weatherData = await weatherRes.json();
        zones.forEach((zone, i) => {
          if (Array.isArray(weatherData) && weatherData[i] && weatherData[i].current) {
            zone.temp = weatherData[i].current.temperature_2m || 25;
            zone.humidity = weatherData[i].current.relative_humidity_2m || 50;
          } else if (weatherData.current) {
            zone.temp = weatherData.current.temperature_2m || 25;
            zone.humidity = weatherData.current.relative_humidity_2m || 50;
          }
        });
      }

      // ── Apply Urban Heat Island (UHI) Variation ──
      // Real weather APIs often return the same temp for points 2-5km apart.
      // We simulate local micro-climates based on land use and density.
      zones.forEach(zone => {
        let uhiOffset = 0;
        // Density impact (up to +2.5°C for extreme high density)
        uhiOffset += (zone.density / 50000) * 2.5;
        // Land use impact
        if (zone.landUse === 'Industrial') uhiOffset += 2.0;
        if (zone.landUse === 'Commercial') uhiOffset += 1.2;
        if (zone.landUse === 'Mixed Use') uhiOffset += 0.5;
        if (zone.landUse === 'Green Space') uhiOffset -= 1.5;
        
        // Green cover impact
        uhiOffset -= (zone.greenCover / 100) * 3.0;

        // Apply and round
        zone.temp = +(zone.temp + uhiOffset).toFixed(1);
      });

      // Fetch AQI for all zones (Open-Meteo US AQI — best free coverage for India)
      const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lngs}&current=us_aqi,pm2_5&timezone=auto`);
      const aqiData = await aqiRes.json();

      zones.forEach((zone, i) => {
        // Try us_aqi first, then pm2_5 conversion, then seeded realistic fallback
        let aqiValue = null;
        const aqiItem = Array.isArray(aqiData) ? aqiData[i] : aqiData;
        if (aqiItem && aqiItem.current) {
          if (aqiItem.current.us_aqi !== null && aqiItem.current.us_aqi !== undefined) {
            aqiValue = aqiItem.current.us_aqi;
          } else if (aqiItem.current.pm2_5 !== null && aqiItem.current.pm2_5 !== undefined) {
            // Approx PM2.5 to US AQI conversion
            const pm = aqiItem.current.pm2_5;
            aqiValue = pm <= 12 ? Math.round(pm * 4.17)
              : pm <= 35.4 ? Math.round(50 + (pm - 12) * 2.10)
              : pm <= 55.4 ? Math.round(100 + (pm - 35.4) * 2.50)
              : Math.round(150 + (pm - 55.4) * 1.47);
          }
        }

        if (aqiValue === null) {
          // Seeded deterministic fallback — realistic for dense Indian urban areas
          const seed = zone.lat * 1000 + zone.lng * 100 + i;
          const pseudoRand = ((Math.sin(seed * 127.1 + i * 311.7) * 43758.5453) % 1 + 1) % 1;
          const baseAqi = zone.temp > 35 ? 160 : zone.temp > 30 ? 110 : 75;
          const densityBonus = zone.density > 30000 ? 60 : zone.density > 15000 ? 30 : 0;
          const greenDiscount = zone.greenCover > 30 ? -30 : zone.greenCover > 15 ? -10 : 0;
          aqiValue = Math.round(baseAqi + densityBonus + greenDiscount + pseudoRand * 40);
        }

        zone.aqi = Math.max(10, Math.min(500, aqiValue));
      });
    } catch (apiErr) {
      console.error('Failed to fetch real data for grid, using fallback', apiErr);
      // Fallbacks are already set in generateZones
    }

    res.json({
      config,
      zones
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/pin', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    
    // Call Open-Meteo for free real weather (including humidity)
    const meteoRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m&timezone=auto`);
    const meteoData = await meteoRes.json();
    
    // Call Open-Meteo for free real Air Quality (AQI)
    const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=european_aqi&timezone=auto`);
    const aqiData = await aqiRes.json();
    
    if (!meteoData || !meteoData.current) {
      return res.status(400).json({ error: 'Could not fetch real weather data for this pin' });
    }
    
    const currentTemp = meteoData.current.temperature_2m;
    const currentHumidity = meteoData.current.relative_humidity_2m;
    
    // Fallback to 50 if AQI API fails or area unsupported
    const currentAqi = (aqiData && aqiData.current && aqiData.current.european_aqi) ? aqiData.current.european_aqi : 50;
    
    // Generate a pseudo-random seed to keep density/greenCover stable for identical coords
    const pseudoRand = (n) => {
      const x = Math.sin((lat + lng) * 9301 + n * 49297) * 10000;
      return x - Math.floor(x);
    };

    const zone = {
      id: `pin_${lat.toFixed(4)}_${lng.toFixed(4)}`,
      name: "Custom Dropped Pin",
      lat,
      lng,
      temp: currentTemp,
      greenCover: Math.floor(5 + pseudoRand(1) * 35),
      density: Math.floor(1000 + pseudoRand(2) * 15000),
      aqi: currentAqi,
      humidity: currentHumidity,
      landUse: "Mixed Use",
      isCustomPin: true
    };
    
    res.json(zone);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching pin data' });
  }
});

// --- Route Plan API ---
function getMockRoutePlan(source, dest, mode) {
  return {
    route_analysis: "Temperature analysis complete. The standard route is hot, so we have simulated a path prioritizing tree-lined streets and shaded avenues to minimize heat exposure.",
    water_to_carry: "Carry at least 1.5 Liters of water from home.",
    hydration_stops: [
      "Stop near local markets for Nariyal Pani (Coconut Water).",
      "Look for public water coolers near transit stops."
    ],
    rest_stops: [
      "Take a 5-minute break under the large trees near the halfway mark.",
      "Rest at any shaded bus shelter if you feel fatigued."
    ],
    precautions: [
      `Avoid direct sun exposure during this ${mode} journey.`,
      "Wear a cap or use an umbrella."
    ],
    estimated_cost: mode === "bus" ? "₹40 - ₹60" : mode === "bike" ? "₹50 (fuel)" : "₹0",
    summary: "Follow this shaded route plan and hydrate properly for a safe journey."
  };
}

app.post('/api/route-plan', async (req, res) => {
  try {
    const { source, destination, mode, currentTemp } = req.body;
    if (!source || !destination) return res.status(400).json({ error: 'Source and destination required' });

    const geminiApiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
    
    if (!geminiApiKey || geminiApiKey === 'your_gemini_api_key_here' || geminiApiKey === '') {
      return res.json(getMockRoutePlan(source, destination, mode));
    }

    const prompt = `You are an advanced urban heat routing AI. A user is travelling from "${source}" to "${destination}" via "${mode}". Current avg temperature is ${currentTemp || 32}°C.
The user strictly requested a heat-optimized route that finds a path with more trees and shade.
Provide a highly specific travel plan in JSON format with exactly these keys:
{
  "route_analysis": "1-2 sentences explaining that the route was analyzed for temperature and optimized for maximum tree cover and less heat.",
  "water_to_carry": "Specific amount of water to carry from home (e.g. 1.5 Liters or 2 Bottles).",
  "hydration_stops": ["Specific realistic local suggestions for this route on where to drink water, get coconut water (nariyal pani), or ORS."],
  "rest_stops": ["Specific realistic local landmarks, parks, or shade spots on this route to take a rest."],
  "precautions": ["2 specific heat tips"],
  "estimated_cost": "Estimated cost in INR",
  "summary": "1 sentence final encouraging remark"
}
Do not return any markdown or extra text.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) throw new Error('Gemini API Error');
    const data = await response.json();
    const raw = data.candidates[0].content.parts[0].text;
    const clean = raw.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(clean));
  } catch (error) {
    console.error(error);
    res.json(getMockRoutePlan(source, destination, mode));
  }
});

// --- REPORTS API ---

app.get('/api/reports/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    // ensure user can only fetch their own reports
    if (parseInt(userId, 10) !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const db = getDB();
    const reports = await db.all(`SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
    res.json(reports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- REAL-TIME TEMPERATURE BY COORDINATES (OpenWeatherMap) ---

app.get('/api/temperature', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng query params required' });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json({ error: 'Invalid lat/lng values' });
    }

    const owmKey = process.env.OWM_API_KEY;

    if (owmKey) {
      // ── OWM path: accurate real-time data including weather description & icon
      const owmUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${parsedLat}&lon=${parsedLng}&appid=${owmKey}&units=metric`;
      const owmData = await fetch(owmUrl).then(r => r.ok ? r.json() : null).catch(() => null);

      if (owmData && owmData.main) {
        const locationName = owmData.name || 'Unknown location';
        const country = owmData.sys?.country || '';
        return res.json({
          lat: parsedLat,
          lng: parsedLng,
          temp: owmData.main.temp,
          feelsLike: owmData.main.feels_like,
          humidity: owmData.main.humidity,
          windSpeed: owmData.wind?.speed ? +(owmData.wind.speed * 3.6).toFixed(1) : 0, // m/s → km/h
          description: owmData.weather?.[0]?.description || 'unknown',
          icon: owmData.weather?.[0]?.icon || '01d',
          locationName,
          country,
          realtime: true,
        });
      }
    }

    // ── Fallback: Open-Meteo + Nominatim (when OWM key is missing or call failed)
    const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${parsedLat}&longitude=${parsedLng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&timezone=auto`;
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${parsedLat}&lon=${parsedLng}&format=json&zoom=16&addressdetails=1`;

    const [meteoData, nominatimData] = await Promise.all([
      fetch(meteoUrl).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(nominatimUrl, { headers: { 'User-Agent': 'HeatGuard/1.0' } }).then(r => r.ok ? r.json() : null).catch(() => null)
    ]);

    let temp = 30, humidity = 50, feelsLike = 32, windSpeed = 10, description = 'unknown', icon = '01d';

    if (meteoData && meteoData.current) {
      temp = meteoData.current.temperature_2m;
      humidity = meteoData.current.relative_humidity_2m;
      feelsLike = meteoData.current.apparent_temperature;
      windSpeed = meteoData.current.wind_speed_10m;
      const code = meteoData.current.weather_code;
      if (code <= 3) { description = 'clear/partly cloudy'; icon = '01d'; }
      else if (code <= 48) { description = 'fog/mist'; icon = '50d'; }
      else if (code <= 69) { description = 'rain/drizzle'; icon = '09d'; }
      else if (code <= 79) { description = 'snow'; icon = '13d'; }
      else { description = 'storm/heavy rain'; icon = '11d'; }
    }

    let locationName = 'Unknown location', country = '';
    if (nominatimData && nominatimData.address) {
      const addr = nominatimData.address;
      locationName = addr.neighbourhood || addr.suburb || addr.quarter || addr.village || addr.town || addr.city || addr.county || 'Unknown';
      country = addr.country_code ? addr.country_code.toUpperCase() : '';
    }

  return res.json({ lat: parsedLat, lng: parsedLng, temp, feelsLike, humidity, windSpeed, description, icon, locationName, country, realtime: !!owmKey });
  } catch (error) {
    console.error('/api/temperature error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- STATIC ASSETS (Production) ---
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../heatguard/dist');
  app.use(express.static(distPath));
  
  // Catch-all route to serve the frontend for any non-API request
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// Initialize DB and Start Server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database', err);
});
