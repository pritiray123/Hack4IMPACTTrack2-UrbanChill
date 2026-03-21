const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

console.log('Testing connection to:', process.env.DATABASE_URL.replace(/:([^@]+)@/, ':****@')); // Hide password

const pool = new Pool({
  user: 'postgres',
  host: 'qquctfjdelurcmpsbnsx.supabase.co', // No db. prefix
  database: 'postgres',
  password: 'kiit@2419@hack',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Success! Result:', res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Connection failed:', err.message);
    process.exit(1);
  }
}

test();
