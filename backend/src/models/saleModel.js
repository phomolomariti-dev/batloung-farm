const { pool } = require('../config/db');

exports.insert = async (conn, d) => (await conn.execute(
  `INSERT INTO sales (vendor_id, payment_status, payment_method, total_amount, amount_paid) VALUES (?,?,?,?,?)`,
  [d.vendor_id, d.payment_status, d.payment_method, d.total_amount, d.amount_paid]))[0].insertId;

exports.insertDetail = async (conn, saleId, it) => conn.execute(
  'INSERT INTO sales_details (sale_id, fruit_id, packaging_size, quantity, unit_price) VALUES (?,?,?,?,?)',
  [saleId, it.fruit_id, it.packaging_size, it.quantity, it.unit_price]);

exports.insertPayment = async (conn, saleId, method, amount) => conn.execute(
  'INSERT INTO payments (sale_id, method, amount) VALUES (?,?,?)', [saleId, method, amount]);

exports.lockById = async (conn, id) =>
  (await conn.execute('SELECT * FROM sales WHERE sale_id = ? FOR UPDATE', [id]))[0][0];

exports.updatePayment = async (conn, id, paid, status) => conn.execute(
  'UPDATE sales SET amount_paid = ?, payment_status = ? WHERE sale_id = ?', [paid, status, id]);

exports.setDelivery = async (id, status) => (await pool.execute(
  "UPDATE sales SET delivery_status = ?, delivered_at = IF(? = 'DELIVERED', NOW(), NULL) WHERE sale_id = ?", [status, status, id]))[0].affectedRows;

exports.pending = async () => (await pool.query(
  `SELECT s.sale_id, s.sale_date, s.total_amount, s.amount_paid, (s.total_amount - s.amount_paid) AS outstanding_balance,
          v.vendor_id, v.vendor_name, v.location, v.latitude, v.longitude
   FROM sales s JOIN vendors v ON v.vendor_id = s.vendor_id
   WHERE s.delivery_status = 'PENDING' ORDER BY s.sale_date`))[0];

exports.findAll = async () => (await pool.query(
  `SELECT s.*, v.vendor_name, (s.total_amount - s.amount_paid) AS outstanding_balance
   FROM sales s JOIN vendors v ON v.vendor_id = s.vendor_id ORDER BY s.sale_date DESC, s.sale_id DESC`))[0];

exports.findById = async (id, conn = pool) => {
  const [rows] = await conn.execute(
    `SELECT s.*, v.vendor_name, v.location, v.latitude, v.longitude,
            (s.total_amount - s.amount_paid) AS outstanding_balance
     FROM sales s JOIN vendors v ON v.vendor_id = s.vendor_id WHERE s.sale_id = ?`, [id]);
  if (!rows.length) return null;
  const [items] = await conn.execute(
    `SELECT sd.sales_detail_id, sd.fruit_id, f.fruit_name, sd.packaging_size, sd.quantity, sd.unit_price,
            (sd.quantity * sd.unit_price) AS line_total
     FROM sales_details sd JOIN fruits f ON f.fruit_id = sd.fruit_id WHERE sd.sale_id = ?`, [id]);
  const [payments] = await conn.execute('SELECT payment_id, method, amount, paid_at FROM payments WHERE sale_id = ? ORDER BY paid_at', [id]);
  return { ...rows[0], items, payments };
};
