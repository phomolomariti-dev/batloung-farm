const model = require('../models/supplierModel');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');
const { estimateTrip } = require('../utils/geo');
const purchaseModel = require('../models/purchaseModel');
const stockModel = require('../models/stockModel');
const { withTransaction } = require('../config/db');
const { SIZES } = require('../middleware/validate');

exports.create = asyncHandler(async (req, res) => {
  const id = await model.create(req.body);
  res.status(201).json({ success: true, message: 'Supplier registered', data: await model.findById(id) });
});
exports.getAll = asyncHandler(async (req, res) => {
  const data = await model.findAll();
  res.status(200).json({ success: true, count: data.length, data });
});
exports.getOne = asyncHandler(async (req, res) => {
  const s = await model.findById(req.params.id);
  if (!s) throw new HttpError(404, `Supplier ${req.params.id} not found`);
  res.status(200).json({ success: true, data: s });
});
exports.trip = asyncHandler(async (req, res) => {
  const s = await model.findById(req.params.id);
  if (!s) throw new HttpError(404, `Supplier ${req.params.id} not found`);
  res.status(200).json({ success: true, data: { supplier_id: s.supplier_id, trip: estimateTrip(s.latitude, s.longitude) } });
});
exports.update = asyncHandler(async (req, res) => {
  if (!(await model.findById(req.params.id))) throw new HttpError(404, `Supplier ${req.params.id} not found`);
  await model.update(req.params.id, req.body);
  res.status(200).json({ success: true, message: 'Supplier updated', data: await model.findById(req.params.id) });
});
exports.remove = asyncHandler(async (req, res) => {
  const result = await withTransaction(async (conn) => {
    if (!(await model.findById(req.params.id, conn))) {
      throw new HttpError(404, `Supplier ${req.params.id} not found`);
    }

    const purchaseCount = await model.countPurchases(req.params.id, conn);
    const stockLines = await model.getPurchaseStock(req.params.id, conn);

    for (const line of stockLines) {
      const available = await stockModel.lockRow(
        conn,
        line.fruit_id,
        line.packaging_size,
      );
      if (available < Number(line.quantity)) {
        throw new HttpError(409,
          `Cannot delete supplier: ${line.quantity} ${line.packaging_size} box(es) of fruit ${line.fruit_id} are in stock or already consumed; available stock is ${available}`);
      }
    }

    for (const line of stockLines) {
      if (!(await stockModel.decrease(
        conn,
        line.fruit_id,
        line.packaging_size,
        Number(line.quantity),
      ))) {
        throw new HttpError(409, 'Stock changed while deleting the supplier. Please retry.');
      }
    }

    await model.removePurchases(req.params.id, conn);
    await model.remove(req.params.id, conn);
    return { purchaseCount };
  });

  res.status(200).json({
    success: true,
    message: 'Supplier and its purchase history deleted',
    deleted_purchases: result.purchaseCount,
  });
});

// Which supplier is really cheapest once the trip from Maseru is included?
// GET /api/suppliers/compare?fruit_id=1&packaging_size=large&quantity=20
exports.compare = asyncHandler(async (req, res) => {
  const fruitId = Number(req.query.fruit_id);
  const size = String(req.query.packaging_size || '').toLowerCase();
  const qty = Number(req.query.quantity) || 1;
  if (!Number.isInteger(fruitId) || fruitId <= 0) throw new HttpError(400, 'fruit_id must be a positive integer');
  if (!SIZES.includes(size)) throw new HttpError(400, `packaging_size must be one of ${SIZES.join(', ')}`);
  if (!Number.isInteger(qty) || qty <= 0) throw new HttpError(400, 'quantity must be a positive whole number');

  const costs = await purchaseModel.lastCostMap();
  const rows = (await model.findAll())
    .filter((s) => costs.has(`${s.supplier_id}|${fruitId}|${size}`) && s.latitude != null)
    .map((s) => {
      const trip = estimateTrip(s.latitude, s.longitude);
      const last_unit_cost = costs.get(`${s.supplier_id}|${fruitId}|${size}`);
      return { supplier_id: s.supplier_id, business_name: s.business_name, province: s.province, last_unit_cost, trip,
        trip_cost_per_box: Math.round((trip.trip_cost / qty) * 100) / 100,
        landed_cost_per_box: Math.round((last_unit_cost + trip.trip_cost / qty) * 100) / 100, tags: [] };
    });
  const mark = (key, tag, getter) => { if (!rows.length) return; const min = Math.min(...rows.map(getter)); rows.filter((r) => getter(r) === min).forEach((r) => r.tags.push(tag)); };
  mark('c', 'CHEAPEST PRICE', (r) => r.last_unit_cost);
  mark('n', 'NEAREST', (r) => r.trip.distance_km);
  mark('b', 'BEST LANDED COST', (r) => r.landed_cost_per_box);
  rows.sort((a, b) => a.landed_cost_per_box - b.landed_cost_per_box);
  res.status(200).json({ success: true, quantity: qty, count: rows.length, data: rows });
});
