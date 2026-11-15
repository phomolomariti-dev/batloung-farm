const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'))); // map dashboard

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ success: true, status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(503).json({ success: false, status: 'degraded', database: 'unavailable', message: err.message });
  }
});

app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/fruits', require('./routes/fruitRoutes'));
app.use('/api/stock', require('./routes/stockRoutes'));
app.use('/api/vendors', require('./routes/vendorRoutes'));
app.use('/api/purchases', require('./routes/purchaseRoutes'));
app.use('/api/sales', require('./routes/saleRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));

app.use(notFound);
app.use(errorHandler);
module.exports = app;
