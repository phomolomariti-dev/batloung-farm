const model = require('../models/supplierModel');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');
const { estimateTrip, depot } = require('../utils/geo');
const purchaseModel = require('../models/purchaseModel');
const { SIZES } = require('../middleware/validate');
const withTrip = (s) => ({ ...s, trip: estimateTrip(s.latitude, s.longitude) });

exports.create = asyncHandler(async (req, res) => {
  const id = await model.create(req.body);
  res.status(201).json({ success: true, message: 'Supplier registered', data: withTrip(await model.findById(id)) });
});
exports.getAll = asyncHandler(async (req, res) => {
  const data = (await model.findAll()).map(withTrip);
  res.status(200).json({ success: true, depot: depot(), count: data.length, data });
});
exports.getOne = asyncHandler(async (req, res) => {
  const s = await model.findById(req.params.id);
  if (!s) throw new HttpError(404, `Supplier ${req.params.id} not found`);
  res.status(200).json({ success: true, data: withTrip(s) });
});
exports.update = asyncHandler(async (req, res) => {
  if (!(await model.findById(req.params.id))) throw new HttpError(404, `Supplier ${req.params.id} not found`);
  await model.update(req.params.id, req.body);
  res.status(200).json({ success: true, message: 'Supplier updated', data: withTrip(await model.findById(req.params.id)) });
});
// Business constraint: a supplier with purchase history cannot be deleted (keeps records consistent)
exports.remove = asyncHandler(async (req, res) => {
  if (!(await model.findById(req.params.id))) throw new HttpError(404, `Supplier ${req.params.id} not found`);
  const n = await model.countPurchases(req.params.id);
  if (n > 0) throw new HttpError(409, `Cannot delete supplier: it has ${n} recorded purchase(s)`);
  await model.remove(req.params.id);
  res.status(200).json({ success: true, message: 'Supplier deleted' });
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
