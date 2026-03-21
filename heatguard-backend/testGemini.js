require('dotenv').config();

async function testGemini25() {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const prompt = `You are an urban climate expert. Analyse this urban zone and give 3 specific green infrastructure interventions.\n\nZone data:\n- Name: Test Zone\n- Land use: Commercial\n- Surface temperature: 38°C\n- Green cover: 10%\n- Air Quality Index: 120\n- Population density: 25000 people/km²\n- Humidity: 45%\n- Heat risk level: HIGH\n\nRespond ONLY with a valid JSON object. No markdown, no explanation outside JSON:\n{\n  "interventions": [\n    {\n      "type": "TREES" | "COOL PAVEMENT" | "ROOFTOP GARDEN" | "GREEN WALL" | "WATER FEATURE" | "PARK",\n      "action": "specific actionable recommendation in one sentence",\n      "impact": "projected temperature reduction and benefit"\n    }\n  ],\n  "summary": "2-sentence overall assessment and most urgent priority",\n  "projected_temp_reduction": "e.g. −3.2°C with all interventions",\n  "priority": "HIGH" | "MEDIUM" | "LOW"\n}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) {
      console.log('HTTP ERROR (2.5-flash):', response.status, await response.text());
      return;
    }

    const data = await response.json();
    console.log('API RESPONSE', JSON.stringify(data.candidates[0], null, 2));

  } catch (err) {
    console.error('FETCH OR PARSE ERORR:', err);
  }
}

testGemini25();
