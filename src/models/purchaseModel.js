const { pool } = require('../config/db');

exports.insert = async (conn, supplierId, total) =>
  (await conn.execute('INSERT INTO purchases (supplier_id, total_amount) VALUES (?,?)', [supplierId, total]))[0].insertId;

exports.insertDetail = async (conn, purchaseId, it) => conn.execute(
  'INSERT INTO purchase_details (purchase_id, fruit_id, quantity, unit_cost, packaging_size) VALUES (?,?,?,?,?)',
  [purchaseId, it.fruit_id, it.quantity, it.unit_cost, it.packaging_size]);

// Latest unit cost paid to each supplier for each fruit + size  ->  Map("supplierId|fruitId|size" -> cost)
exports.lastCostMap = async () => {
  const [rows] = await pool.query(
    `SELECT p.supplier_id, pd.fruit_id, pd.packaging_size, pd.unit_cost
     FROM purchase_details pd JOIN purchases p ON p.purchase_id = pd.purchase_id
     ORDER BY p.purchase_date, pd.purchase_detail_id`);
  const map = new Map();
  rows.forEach((r) => map.set(`${r.supplier_id}|${r.fruit_id}|${r.packaging_size}`, r.unit_cost)); // later rows overwrite earlier
  return map;
};

exports.findAll = async () => (await pool.query(
  `SELECT p.*, s.business_name, s.province FROM purchases p
   JOIN suppliers s ON s.supplier_id = p.supplier_id ORDER BY p.purchase_date DESC, p.purchase_id DESC`))[0];

exports.findById = async (id, conn = pool) => {
  const [rows] = await conn.execute(
    `SELECT p.*, s.business_name, s.province, s.latitude, s.longitude FROM purchases p
     JOIN suppliers s ON s.supplier_id = p.supplier_id WHERE p.purchase_id = ?`, [id]);
  if (!rows.length) return null;
  const [items] = await conn.execute(
    `SELECT pd.purchase_detail_id, pd.fruit_id, f.fruit_name, pd.packaging_size, pd.quantity, pd.unit_cost,
            (pd.quantity * pd.unit_cost) AS line_total
     FROM purchase_details pd JOIN fruits f ON f.fruit_id = pd.fruit_id WHERE pd.purchase_id = ?`, [id]);
  return { ...rows[0], items };
};
