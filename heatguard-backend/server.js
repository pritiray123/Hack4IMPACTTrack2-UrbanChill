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
  const reductionMap = {
    LOW: "−1.4°C",
    MODERATE: "−2.6°C",
    HIGH: "−3.8°C",
    CRITICAL: "−4.9°C",
  };

  const interventionSets = {
    Residential: [
      {
        type: "TREES",
        action: `Plant 200 fast-growing native trees (Neem, Peepal, Banyan) along the main residential arterials in ${zone.name}`,
        impact: `−1.5°C avg surface temp, ${Math.round(zone.density * 0.09).toLocaleString()} residents benefited`,
      },
      {
        type: "ROOFTOP GARDEN",
        action: `Convert 35% of flat concrete rooftops in ${zone.name} to green roofs with drought-resistant vegetation`,
        impact: `−1.2°C surface temp, reduces urban runoff by 55%`,
      },
      {
        type: "COOL PAVEMENT",
        action: `Replace 2 km of dark asphalt on main roads with high-albedo reflective cool pavement`,
        impact: `−0.9°C local temp, 30% less heat absorption during peak hours`,
      },
    ],
    Commercial: [
      {
        type: "GREEN WALL",
        action: `Install vertical green walls on south-facing facades of the 5 largest commercial buildings in ${zone.name}`,
        impact: `−1.3°C facade surface temp, improves pedestrian comfort index by 40%`,
      },
      {
        type: "COOL PAVEMENT",
        action: `Apply cool pavement coating across the main commercial street and parking areas`,
        impact: `−1.1°C local ambient temp, reduces heat absorption by 35%`,
      },
      {
        type: "WATER FEATURE",
        action: `Install evaporative cooling mist systems at 4 high-footfall intersections in the commercial zone`,
        impact: `−2°C localised cooling, benefits ${Math.round(zone.density * 0.05).toLocaleString()} daily commuters`,
      },
    ],
    Industrial: [
      {
        type: "GREEN WALL",
        action: `Cover perimeter walls of industrial units in ${zone.name} with climbing vegetation and modular green panels`,
        impact: `−1.4°C surface temp, absorbs 20% of local particulate matter`,
      },
      {
        type: "TREES",
        action: `Plant a 15m wide tree buffer belt along the industrial zone boundary facing residential areas`,
        impact: `−1.8°C temp at zone boundary, reduces AQI exposure for ${Math.round(zone.density * 0.12).toLocaleString()} residents`,
      },
      {
        type: "ROOFTOP GARDEN",
        action: `Convert flat industrial rooftops to solar-green hybrid roofs combining PV panels and sedum vegetation`,
        impact: `−1.0°C surface temp, generates renewable energy reducing heat-generating activity`,
      },
    ],
    "Mixed Use": [
      {
        type: "PARK",
        action: `Develop a 2-hectare pocket park with native trees and water bodies at the centre of ${zone.name}`,
        impact: `−2.0°C within 300m radius, creates green corridor for ${Math.round(zone.density * 0.15).toLocaleString()} residents`,
      },
      {
        type: "COOL PAVEMENT",
        action: `Retrofit all pedestrian walkways and plazas in ${zone.name} with light-coloured permeable paving`,
        impact: `−0.8°C local temp, 25% reduction in surface heat retention`,
      },
      {
        type: "TREES",
        action: `Plant 150 shade trees with continuous tree canopy coverage along the mixed-use main street`,
        impact: `−1.6°C under canopy, reduces pedestrian heat stress index by 45%`,
      },
    ],
    "Green Space": [
      {
        type: "WATER FEATURE",
        action: `Add seasonal water bodies and misting walkways throughout the existing green space in ${zone.name}`,
        impact: `−1.5°C ambient temp, extends usable hours by 3hrs during peak summer`,
      },
      {
        type: "TREES",
        action: `Increase canopy density by planting 100 additional large-canopy native trees in sparse areas`,
        impact: `−1.2°C avg temp, improves biodiversity and carbon sequestration`,
      },
      {
        type: "COOL PAVEMENT",
        action: `Replace existing paths with permeable cool paving to reduce runoff and surface heat`,
        impact: `−0.6°C path surface temp, 40% better rainwater absorption`,
      },
    ],
  };

  const interventions = interventionSets[zone.landUse] || interventionSets["Mixed Use"];

  return {
    interventions,
    summary: `${zone.name} is experiencing ${risk.label.toLowerCase()} heat stress with only ${zone.greenCover}% green cover and a surface temperature of ${zone.temp}°C. The most urgent intervention is ${interventions[0].type.toLowerCase()} deployment to achieve immediate cooling relief.`,
    projected_temp_reduction: reductionMap[risk.label] || "−2.5°C",
    priority: risk.label === "LOW" ? "LOW" : risk.label === "MODERATE" ? "MEDIUM" : "HIGH",
    residents_benefited: Math.round(zone.density * 0.2),
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
    const cityName = req.params.name.trim().toLowerCase();
    const config = CITY_CONFIGS[cityName];
    
    if (!config) {
      return res.status(404).json({ error: 'City not found or supported' });
    }

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

    const zones = generateZones(cityName, config.lat, config.lng, baseTempOffset);
    
    res.json({
      config,
      zones
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
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

// --- REAL-TIME TEMPERATURE BY COORDINATES ---

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

    const OWM_KEY = process.env.OWM_API_KEY ? process.env.OWM_API_KEY.trim() : null;

    // Run OWM + Nominatim reverse geocoding in parallel
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${parsedLat}&lon=${parsedLng}&format=json&zoom=16&addressdetails=1`;

    const nominatimPromise = fetch(nominatimUrl, {
      headers: { 'User-Agent': 'HeatGuard/1.0 (urban heat monitoring app)' }
    }).then(r => r.json()).catch(() => null);

    if (OWM_KEY && OWM_KEY !== 'your_openweathermap_key_here' && OWM_KEY !== '') {
      console.log(`[/api/temperature] Using OWM live data for ${parsedLat},${parsedLng}`);

      const [owmRes, nominatimData] = await Promise.all([
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${parsedLat}&lon=${parsedLng}&appid=${OWM_KEY}&units=metric`),
        nominatimPromise
      ]);

      console.log(`[/api/temperature] OWM response status: ${owmRes.status}`);

      if (!owmRes.ok) {
        const errText = await owmRes.text();
        console.error(`[/api/temperature] OWM API error: ${owmRes.status} ${errText}`);
        throw new Error(`OWM error: ${owmRes.status} ${errText}`);
      }

      const owmData = await owmRes.json();
      console.log(`[/api/temperature] OWM success: ${owmData.main?.temp}°C at ${owmData.name}`);

      // Build precise location name from Nominatim
      let locationName = owmData.name || '';
      let country = owmData.sys?.country || '';
      if (nominatimData && nominatimData.address) {
        const addr = nominatimData.address;
        // Pick most precise available label: neighbourhood > suburb > quarter > village > town > city
        locationName = addr.neighbourhood || addr.suburb || addr.quarter || addr.village || addr.town || addr.city || addr.county || owmData.name || '';
        country = addr.country_code ? addr.country_code.toUpperCase() : country;
      }



      return res.json({
        lat: parsedLat,
        lng: parsedLng,
        temp: Math.round(owmData.main.temp * 10) / 10,
        feelsLike: Math.round(owmData.main.feels_like * 10) / 10,
        humidity: owmData.main.humidity,
        windSpeed: Math.round(owmData.wind.speed * 3.6 * 10) / 10, // m/s → km/h
        description: owmData.weather[0].description,
        icon: owmData.weather[0].icon,
        locationName: locationName || owmData.name || 'Unknown',
        country: country || owmData.sys?.country || '',
        realtime: true,
      });
    }

    // --- Fallback: estimated temp + Nominatim for location name ---
    const [nominatimFallback, ] = await Promise.all([nominatimPromise]);
    const seed = Math.sin(parsedLat * 127.3 + parsedLng * 311.7) * 10000;
    const pseudo = seed - Math.floor(seed);
    const now = new Date();
    const timeOscillation = Math.sin(now.getMinutes() / 10) * 2;
    const latFactor = Math.max(0, (30 - Math.abs(parsedLat)) / 30);
    const estimatedTemp = +(28 + latFactor * 12 + pseudo * 6 + timeOscillation).toFixed(1);
    const estimatedHumidity = Math.round(40 + pseudo * 50);
    const estimatedWind = +(5 + pseudo * 20).toFixed(1);

    // Get location name from Nominatim even for fallback
    let fallbackLocation = 'Unknown location';
    let fallbackCountry = '';
    if (nominatimFallback && nominatimFallback.address) {
      const addr = nominatimFallback.address;
      fallbackLocation = addr.neighbourhood || addr.suburb || addr.quarter || addr.village || addr.town || addr.city || addr.county || 'Unknown';
      fallbackCountry = addr.country_code ? addr.country_code.toUpperCase() : '';
    }

    return res.json({
      lat: parsedLat,
      lng: parsedLng,
      temp: estimatedTemp,
      feelsLike: +(estimatedTemp + (estimatedHumidity > 70 ? 2 : -1)).toFixed(1),
      humidity: estimatedHumidity,
      windSpeed: estimatedWind,
      description: estimatedTemp > 38 ? 'hot and humid' : estimatedTemp > 32 ? 'warm and sunny' : 'partly cloudy',
      icon: estimatedTemp > 35 ? '01d' : '02d',
      locationName: fallbackLocation,
      country: fallbackCountry,
      realtime: false,
    });
  } catch (error) {
    console.error('/api/temperature error:', error);
    res.status(500).json({ error: error.message });
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
