const { pool } = require('../config/db');
const { SIZES } = require('../middleware/validate');
const { buildUpdate } = require('../utils/helpers');

const SELECT_WITH_PRICES = `
  SELECT f.*,
    MAX(CASE WHEN p.packaging_size='small'  THEN p.unit_price END) AS price_small,
    MAX(CASE WHEN p.packaging_size='medium' THEN p.unit_price END) AS price_medium,
    MAX(CASE WHEN p.packaging_size='large'  THEN p.unit_price END) AS price_large
  FROM fruits f LEFT JOIN prices p ON p.fruit_id = f.fruit_id`;

// Creates the fruit, its 3 stock rows (0 boxes each) and optional selling prices
exports.create = async (conn, d) => {
  const [r] = await conn.execute('INSERT INTO fruits (fruit_name, description, status) VALUES (?,?,?)',
    [d.fruit_name.trim(), d.description || null, d.status || 'ACTIVE']);
  for (const size of SIZES) {
    await conn.execute('INSERT INTO stock (fruit_id, packaging_size, available_quantity) VALUES (?,?,0)', [r.insertId, size]);
  }
  if (d.prices) await exports.setPrices(conn, r.insertId, d.prices);
  return r.insertId;
};

exports.setPrices = async (conn, fruitId, prices) => {
  for (const size of SIZES) {
    if (prices[size] === undefined) continue;
    await conn.execute(
      `INSERT INTO prices (fruit_id, packaging_size, unit_price) VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE unit_price = VALUES(unit_price)`, [fruitId, size, prices[size]]);
  }
};

exports.findAll = async (includeInactive) =>
  (await pool.query(`${SELECT_WITH_PRICES} ${includeInactive ? '' : "WHERE f.status = 'ACTIVE'"} GROUP BY f.fruit_id ORDER BY f.fruit_name`))[0];

exports.findById = async (id, conn = pool) =>
  (await conn.execute(`${SELECT_WITH_PRICES} WHERE f.fruit_id = ? GROUP BY f.fruit_id`, [id]))[0][0];

exports.update = async (id, body) => {
  const { sql, values } = buildUpdate(['fruit_name', 'description', 'status'], body);
  return (await pool.execute(`UPDATE fruits SET ${sql} WHERE fruit_id = ?`, [...values, id]))[0].affectedRows;
};

exports.getPrice = async (conn, fruitId, size) => {
  const [rows] = await conn.execute('SELECT unit_price FROM prices WHERE fruit_id = ? AND packaging_size = ?', [fruitId, size]);
  return rows.length ? rows[0].unit_price : null;
};
