const { Pool } = require('pg');
const { DATABASE_URL } = require('../config/config');

let dbConnected = false;

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

pool.on('connect', () => {
  if (!dbConnected) {
    console.log('✅ [PostgreSQL] Connected to database successfully');
    dbConnected = true;
  }
});

pool.on('error', (err) => {
  console.warn('⚠️ [PostgreSQL] Pool warning/error (using cache fallback):', err.message);
  dbConnected = false;
});

// Test initial connection
(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ [PostgreSQL] Database pool initialized.');
    dbConnected = true;
    client.release();
  } catch (err) {
    console.warn(`⚠️ [PostgreSQL] Initial connection failed (${err.message}). In-memory buffer active.`);
    dbConnected = false;
  }
})();

module.exports = {
  pool,
  isDbConnected: () => dbConnected
};
