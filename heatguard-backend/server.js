const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)));
const { initDB, getDB } = require('./db');

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

    const languageInstruction = language && language !== 'en' ? ` Please provide all outputs and recommendations translated into ${language.toUpperCase()}.` : '';

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

function generateZones(cityKey, centerLat, centerLng, baseTempOffset = 0) {
  const zones = [];
  const GRID = 5;
  const SPREAD = 0.06;
  const startLat = centerLat - (GRID / 2) * SPREAD;
  const startLng = centerLng - (GRID / 2) * SPREAD;

  const seed = cityKey.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const now = new Date();
  const timeOffset = Math.sin(now.getMinutes() / 5) * 2; // oscillates ±2 degrees every 5 mins
  const cityNamesList = CITY_ZONE_NAMES[cityKey] || GENERIC_ZONE_PREFIXES;

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const idx = row * GRID + col;
      const pseudoRand = (n) => {
        const x = Math.sin(seed * 9301 + idx * 49297 + n * 233) * 10000;
        return x - Math.floor(x);
      };

      const lat = startLat + row * SPREAD + (pseudoRand(1) - 0.5) * 0.01;
      const lng = startLng + col * SPREAD + (pseudoRand(2) - 0.5) * 0.01;
      // base temp + randomized local offset + live time oscillation + OWM base offset
      const temp = +(28 + pseudoRand(3) * 16 + timeOffset + baseTempOffset).toFixed(1);
      const greenCover = +(5 + pseudoRand(4) * 55).toFixed(1);
      const density = Math.round(3000 + pseudoRand(5) * 45000);
      const aqi = Math.round(40 + pseudoRand(6) * 180 + Math.random() * 5); // Slight live jitter
      const humidity = Math.round(30 + pseudoRand(7) * 60);
      const landUse = LAND_USES[Math.floor(pseudoRand(8) * LAND_USES.length)];
      
      const zoneName = cityNamesList[idx % cityNamesList.length];

      zones.push({
        id: `z_${cityKey}_${row}_${col}`,
        name: zoneName,
        lat,
        lng,
        temp,
        greenCover,
        density,
        aqi,
        humidity,
        landUse,
      });
    }
  }
  return zones;
}

app.get('/api/city/:name', async (req, res) => {
  try {
    const query = req.params.name.trim();
    
    // Geocode the query using Nominatim OpenStreetMap API
    const geocodeRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, {
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

    let baseTempOffset = 0;
    const OWM_KEY = process.env.OWM_API_KEY;
    
    if (OWM_KEY && OWM_KEY !== 'your_openweathermap_key_here') {
      try {
        const owmRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${config.lat}&lon=${config.lng}&appid=${OWM_KEY}&units=metric`);
        if (owmRes.ok) {
          const owmData = await owmRes.json();
          const currentTemp = owmData.main.temp;
          // Calculate an offset so the average of the grid roughly matches the current temp
          baseTempOffset = currentTemp - 36; // 36 is roughly the unshifted average (28 + 16/2)
        }
      } catch (err) {
        console.error('Failed to fetch OWM data, using fallback logic', err);
      }
    }

    // Generate grid based on the dynamically found coordinates and name
    const zones = generateZones(displayName.toLowerCase(), config.lat, config.lng, baseTempOffset);
    
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

// Initialize DB and Start Server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database', err);
});
