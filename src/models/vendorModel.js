const { pool } = require('../config/db');
const { buildUpdate } = require('../utils/helpers');

const FIELDS = ['vendor_name', 'phone_number', 'location', 'latitude', 'longitude'];

exports.create = async (d) => {
  const [r] = await pool.execute(
    'INSERT INTO vendors (vendor_name, phone_number, location, latitude, longitude) VALUES (?,?,?,?,?)',
    [d.vendor_name.trim(), d.phone_number.trim(), d.location.trim(),
      d.latitude ?? null, d.longitude ?? null]);
  return r.insertId;
};
exports.findAll = async () => (await pool.query('SELECT * FROM vendors ORDER BY vendor_name'))[0];
exports.findById = async (id, conn = pool) => (await conn.execute('SELECT * FROM vendors WHERE vendor_id = ?', [id]))[0][0];
exports.search = async (term) => {
  const like = `%${term}%`;
  return (await pool.execute(
    'SELECT * FROM vendors WHERE vendor_name LIKE ? OR phone_number LIKE ? ORDER BY vendor_name', [like, like]))[0];
};
exports.update = async (id, body) => {
  const { sql, values } = buildUpdate(FIELDS, body);
  return (await pool.execute(`UPDATE vendors SET ${sql} WHERE vendor_id = ?`, [...values, id]))[0].affectedRows;
};

// Total billed, total paid and outstanding balance per vendor
const BALANCE_SQL = `
  SELECT v.vendor_id, v.vendor_name, v.phone_number, v.location, v.latitude, v.longitude,
         COUNT(s.sale_id) AS total_orders,
         COALESCE(SUM(s.total_amount), 0) AS total_billed,
         COALESCE(SUM(s.amount_paid), 0)  AS total_paid,
         COALESCE(SUM(s.total_amount - s.amount_paid), 0) AS outstanding_balance
  FROM vendors v LEFT JOIN sales s ON s.vendor_id = v.vendor_id`;

exports.balances = async ({ outstandingOnly = false } = {}) => (await pool.query(
  `${BALANCE_SQL} GROUP BY v.vendor_id ${outstandingOnly ? 'HAVING outstanding_balance > 0' : ''}
   ORDER BY outstanding_balance DESC, v.vendor_name`))[0];

exports.balanceFor = async (id) =>
  (await pool.execute(`${BALANCE_SQL} WHERE v.vendor_id = ? GROUP BY v.vendor_id`, [id]))[0][0];
