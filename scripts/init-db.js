// Usage: npm run db:init
// Runs database/schema.sql (tables + sample data) against the MySQL server in .env.
// On managed hosts where you cannot CREATE DATABASE, set INIT_CREATE_DB=false.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  let sql = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  if (process.env.INIT_CREATE_DB === 'false') {
    sql = sql.replace(/^CREATE DATABASE.*$/gim, '').replace(/^USE .*;$/gim, '');
  } else {
    sql = sql.replace(/batloung_farm/g, process.env.DB_NAME || 'batloung_farm');
  }
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST, port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD,
      database: process.env.INIT_CREATE_DB === 'false' ? process.env.DB_NAME : undefined,
      multipleStatements: true, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    });
    await conn.query(sql);
    await conn.end();
    console.log('Database created and sample data inserted.');
  } catch (err) {
    console.error('Database initialisation failed:', err.message);
    process.exit(1);
  }
})();
