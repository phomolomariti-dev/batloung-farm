require('dotenv').config();
const mysql = require('mysql2/promise');

// Credentials come ONLY from environment variables (.env) - nothing is hardcoded.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 10000,
  decimalNumbers: true, // DECIMAL columns come back as numbers, not strings
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
});

// Never throws: a failed connection is reported, the app keeps running.
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log(`[db] Connected to MySQL database "${process.env.DB_NAME}"`);
    return true;
  } catch (err) {
    console.error(`[db] Connection failed (${err.code || 'UNKNOWN'}): ${err.message}`);
    return false;
  }
}

// Runs fn(conn) inside BEGIN ... COMMIT; any error triggers ROLLBACK.
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.query('BEGIN');
    const result = await fn(conn);
    await conn.query('COMMIT');
    return result;
  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch (rbErr) { console.error('[db] rollback failed:', rbErr.message); }
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, testConnection, withTransaction };
