const { pool } = require('../config/db');
const { buildUpdate } = require('../utils/helpers');

const FIELDS = ['business_name', 'contact_person', 'phone', 'province', 'address', 'latitude', 'longitude'];

exports.create = async (d) => {
  const [r] = await pool.execute(
    'INSERT INTO suppliers (business_name, contact_person, phone, province, address, latitude, longitude) VALUES (?,?,?,?,?,?,?)',
    [d.business_name.trim(), d.contact_person.trim(), d.phone.trim(), d.province, d.address.trim(),
      d.latitude ?? null, d.longitude ?? null]);
  return r.insertId;
};
exports.findAll = async () => (await pool.query('SELECT * FROM suppliers ORDER BY business_name'))[0];
exports.findById = async (id, conn = pool) =>
  (await conn.execute('SELECT * FROM suppliers WHERE supplier_id = ?', [id]))[0][0];
exports.update = async (id, body) => {
  const { sql, values } = buildUpdate(FIELDS, body);
  const [r] = await pool.execute(`UPDATE suppliers SET ${sql} WHERE supplier_id = ?`, [...values, id]);
  return r.affectedRows;
};
exports.countPurchases = async (id, conn = pool) =>
  (await conn.execute('SELECT COUNT(*) AS n FROM purchases WHERE supplier_id = ?', [id]))[0][0].n;
exports.getPurchaseStock = async (id, conn = pool) =>
  (await conn.execute(
    `SELECT pd.fruit_id, pd.packaging_size, SUM(pd.quantity) AS quantity
     FROM purchase_details pd
     JOIN purchases p ON p.purchase_id = pd.purchase_id
     WHERE p.supplier_id = ?
     GROUP BY pd.fruit_id, pd.packaging_size`,
    [id]))[0];
exports.removePurchases = async (id, conn = pool) =>
  (await conn.execute('DELETE FROM purchases WHERE supplier_id = ?', [id]))[0].affectedRows;
exports.remove = async (id, conn = pool) =>
  (await conn.execute('DELETE FROM suppliers WHERE supplier_id = ?', [id]))[0].affectedRows;
