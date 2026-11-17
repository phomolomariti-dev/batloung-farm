const { HttpError } = require('../middleware/errorHandler');
const { SIZES } = require('../middleware/validate');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Builds "col = ?, col2 = ?" for a partial update from an allow-list of columns
function buildUpdate(allowed, body) {
  const cols = Object.keys(body).filter((k) => allowed.includes(k) && body[k] !== undefined);
  if (!cols.length) throw new HttpError(400, `No valid fields to update. Allowed: ${allowed.join(', ')}`);
  return { sql: cols.map((c) => `${c} = ?`).join(', '), values: cols.map((c) => body[c]) };
}

// Validates the "items" array of a purchase or sale and normalises it
function validateItems(items, { needCost = false } = {}) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'items must be a non-empty array');
  return items.map((it, i) => {
    const n = i + 1;
    const fruit_id = Number(it.fruit_id);
    const quantity = Number(it.quantity);
    const packaging_size = String(it.packaging_size || '').toLowerCase();
    if (!Number.isInteger(fruit_id) || fruit_id <= 0) throw new HttpError(400, `Item ${n}: fruit_id must be a positive integer`);
    if (!SIZES.includes(packaging_size)) throw new HttpError(400, `Item ${n}: packaging_size must be one of ${SIZES.join(', ')}`);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new HttpError(400, `Item ${n}: quantity must be a positive whole number of boxes`);
    const out = { fruit_id, packaging_size, quantity };
    if (needCost) {
      const unit_cost = Number(it.unit_cost);
      if (!(unit_cost > 0)) throw new HttpError(400, `Item ${n}: unit_cost must be greater than 0`);
      out.unit_cost = unit_cost;
    }
    return out;
  });
}

// Same fruit + size listed twice in one sale => add quantities (so stock is checked on the combined total)
function mergeItems(items) {
  const map = new Map();
  for (const it of items) {
    const key = `${it.fruit_id}|${it.packaging_size}`;
    if (map.has(key)) map.get(key).quantity += it.quantity;
    else map.set(key, { ...it });
  }
  return [...map.values()];
}

function paymentStatus(total, paid) {
  if (paid <= 0) return 'UNPAID';
  return paid >= total ? 'PAID' : 'PARTIALLY_PAID';
}

module.exports = { round2, buildUpdate, validateItems, mergeItems, paymentStatus };
