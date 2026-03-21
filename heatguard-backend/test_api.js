const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)));

async function test() {
  try {
    const lats = [19.04, 19.05];
    const lngs = [72.86, 72.87];
    
    // Batch query weather
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats.join(',')}&longitude=${lngs.join(',')}&current=temperature_2m,relative_humidity_2m&timezone=auto`);
    const weatherData = await weatherRes.json();
    
    // Batch query AQI
    const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats.join(',')}&longitude=${lngs.join(',')}&current=european_aqi&timezone=auto`);
    const aqiData = await aqiRes.json();
    
    console.log("Weather:", JSON.stringify(weatherData, null, 2));
    console.log("AQI:", JSON.stringify(aqiData, null, 2));
  } catch (err) {
    console.error(err);
  }
}

test();
