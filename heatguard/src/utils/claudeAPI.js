import { getRisk } from './riskHelpers';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:5000');

function buildPrompt(zone, risk) {
  return `You are an urban climate expert. Analyse this urban zone and give 3 specific green infrastructure interventions.

Zone data:
- Name: ${zone.name}
- Land use: ${zone.landUse}
- Surface temperature: ${zone.temp}°C
- Green cover: ${zone.greenCover}%
- Air Quality Index: ${zone.aqi}
- Population density: ${zone.density} people/km²
- Humidity: ${zone.humidity}%
- Heat risk level: ${risk.label}

Respond ONLY with a valid JSON object. No markdown, no explanation outside JSON:
{
  "interventions": [
    {
      "type": "TREES" | "COOL PAVEMENT" | "ROOFTOP GARDEN" | "GREEN WALL" | "WATER FEATURE" | "PARK",
      "action": "specific actionable recommendation in one sentence",
      "impact": "projected temperature reduction and benefit"
    }
  ],
  "summary": "2-sentence overall assessment and most urgent priority",
  "projected_temp_reduction": "e.g. −3.2°C with all interventions",
  "priority": "HIGH" | "MEDIUM" | "LOW"
}`;
}

function getMockData(zone, risk) {
  return {
    interventions: [
      {
        type: 'TREES',
        action: `Plant 200 native shade trees along main arterials in ${zone.name}`,
        impact: `−1.5°C avg temp, ${Math.round(zone.density * 0.08)} residents benefited`,
      },
      {
        type: 'ROOFTOP GARDEN',
        action: 'Convert 40% of flat commercial rooftops to green roofs',
        impact: '−1.2°C surface temp, reduces runoff by 60%',
      },
      {
        type: 'COOL PAVEMENT',
        action: 'Replace 3 km of dark asphalt with reflective cool pavement',
        impact: '−0.8°C local temp, 30% less heat absorption',
      },
    ],
    summary: `${zone.name} shows ${risk.label.toLowerCase()} heat stress driven by low green cover. Immediate tree planting on arterials will deliver the fastest cooling benefit.`,
    projected_temp_reduction: '−3.2°C with all interventions',
    priority: risk.label,
  };
}

export async function getRecommendations(zone, lang = 'en') {
  const risk = getRisk(zone.temp);
  const token = localStorage.getItem('heatguard_token');
  
  try {
    const res = await fetch(`${API_BASE_URL}/api/analyse-zone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        zone,
        risk,
        language: lang
      }),
    });

    if (!res.ok) {
      throw new Error(`Proxy error: ${res.statusText}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Claude Proxy API call failed, using local mock data:', err);
    return getMockData(zone, risk);
  }
}
