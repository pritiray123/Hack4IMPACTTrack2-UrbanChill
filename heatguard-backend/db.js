const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

function parseConnectionString(url) {
  try {
    // Better regex to split user:pass from host:port/db
    const uriMatch = url.match(/postgresql:\/\/([^:]+):(.*)@([^:/]+)(?::(\d+))?\/(.+)/);
    if (!uriMatch) return { connectionString: url };
    
    return {
      user: uriMatch[1],
      password: decodeURIComponent(uriMatch[2]), // Decode if the user encoded it, otherwise leave as is
      host: uriMatch[3],
      port: parseInt(uriMatch[4] || 6543), // Use 6543 as the default Pooler port for stability
      database: uriMatch[5].split('?')[0]
    };
  } catch (e) {
    return { connectionString: url };
  }
}

const dbConfig = parseConnectionString(process.env.DATABASE_URL || '');
const pool = new Pool({
  ...dbConfig,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

let db = {
  // Wrapper to mimic sqlite-like methods for easier server.js migration
  run: async (query, params = []) => {
    // Convert ? to $1, $2, etc.
    let index = 1;
    const pgQuery = query.replace(/\?/g, () => `$${index++}`);
    const result = await pool.query(pgQuery, params);
    return { lastID: result.rows[0]?.id || null, changes: result.rowCount };
  },
  get: async (query, params = []) => {
    let index = 1;
    const pgQuery = query.replace(/\?/g, () => `$${index++}`);
    const result = await pool.query(pgQuery, params);
    return result.rows[0];
  },
  all: async (query, params = []) => {
    let index = 1;
    const pgQuery = query.replace(/\?/g, () => `$${index++}`);
    const result = await pool.query(pgQuery, params);
    return result.rows;
  },
  exec: async (query) => {
    return await pool.query(query);
  }
};

async function initDB() {
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('PostgreSQL Connected');

    // Create Tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cities (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        name TEXT NOT NULL,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        last_analysed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS zones (
        id TEXT PRIMARY KEY,
        city_id INTEGER REFERENCES cities(id),
        name TEXT,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        temp DOUBLE PRECISION,
        aqi INTEGER,
        green_cover DOUBLE PRECISION,
        density INTEGER,
        humidity DOUBLE PRECISION,
        land_use TEXT
      );

      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        zone_id TEXT REFERENCES zones(id),
        interventions_json TEXT,
        summary TEXT,
        projected_reduction TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('PostgreSQL Schema Initialized');
    return db;
  } catch (err) {
    console.error('Database Initialization Error:', err);
    throw err;
  }
}

function getDB() {
  return db;
}

module.exports = { initDB, getDB, pool };
