require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./config/db');

const PORT = process.env.PORT || 5000;

// A DB failure must never kill the process: log it and keep serving (requests get a 503)
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

app.listen(PORT, async () => {
  console.log(`[server] Batloung Farm running - open http://localhost:${PORT}/  (API health: http://localhost:${PORT}/api/health)`);
  const ok = await testConnection();
  if (!ok) console.warn('[server] Running WITHOUT a database connection. Check your .env settings.');
});
