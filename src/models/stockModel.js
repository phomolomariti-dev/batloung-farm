const { pool } = require('../config/db');

const ORDER = "ORDER BY f.fruit_name, FIELD(st.packaging_size,'small','medium','large')";

exports.findAll = async () => (await pool.query(
  `SELECT st.stock_id, f.fruit_id, f.fruit_name, st.packaging_size, st.available_quantity
   FROM stock st JOIN fruits f ON f.fruit_id = st.fruit_id ${ORDER}`))[0];

exports.findByFruit = async (fruitId) => (await pool.execute(
  `SELECT st.stock_id, f.fruit_id, f.fruit_name, st.packaging_size, st.available_quantity
   FROM stock st JOIN fruits f ON f.fruit_id = st.fruit_id WHERE f.fruit_id = ? ${ORDER}`, [fruitId]))[0];

exports.findLow = async (threshold) => (await pool.execute(
  `SELECT st.stock_id, f.fruit_id, f.fruit_name, st.packaging_size, st.available_quantity
   FROM stock st JOIN fruits f ON f.fruit_id = st.fruit_id
   WHERE st.available_quantity <= ? ${ORDER}`, [threshold]))[0];

// Locks the row so two simultaneous sales cannot both take the last boxes
exports.lockRow = async (conn, fruitId, size) => {
  const [rows] = await conn.execute(
    'SELECT available_quantity FROM stock WHERE fruit_id = ? AND packaging_size = ? FOR UPDATE', [fruitId, size]);
  return rows.length ? rows[0].available_quantity : 0;
};

exports.increase = async (conn, fruitId, size, qty) => {
  await conn.execute(
    `INSERT INTO stock (fruit_id, packaging_size, available_quantity) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE available_quantity = available_quantity + VALUES(available_quantity)`, [fruitId, size, qty]);
};

// Returns false if there is not enough stock (never goes negative)
exports.decrease = async (conn, fruitId, size, qty) => {
  const [r] = await conn.execute(
    `UPDATE stock SET available_quantity = available_quantity - ?
     WHERE fruit_id = ? AND packaging_size = ? AND available_quantity >= ?`, [qty, fruitId, size, qty]);
  return r.affectedRows === 1;
};
