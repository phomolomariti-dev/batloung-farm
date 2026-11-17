const { withTransaction } = require('../config/db');
const supplierModel = require('../models/supplierModel');
const fruitModel = require('../models/fruitModel');
const stockModel = require('../models/stockModel');
const purchaseModel = require('../models/purchaseModel');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');
const { validateItems, round2 } = require('../utils/helpers');
const { estimateTrip, planSupplierRoute } = require('../utils/geo');

exports.create = asyncHandler(async (req, res) => {
  const supplierId = Number(req.body.supplier_id);
  if (!Number.isInteger(supplierId) || supplierId <= 0) throw new HttpError(400, 'supplier_id must be a positive integer');
  const items = validateItems(req.body.items, { needCost: true });

  // All-or-nothing: purchase header + details + stock increase, or nothing at all
  const purchase = await withTransaction(async (conn) => {
    const supplier = await supplierModel.findById(supplierId);
    if (!supplier) throw new HttpError(404, `Supplier ${supplierId} not found`);

    let total = 0;
    for (const [i, it] of items.entries()) {
      const fruit = await fruitModel.findById(it.fruit_id, conn);
      if (!fruit) throw new HttpError(400, `Item ${i + 1}: fruit ${it.fruit_id} does not exist`);
      if (fruit.status !== 'ACTIVE') throw new HttpError(400, `Item ${i + 1}: ${fruit.fruit_name} is INACTIVE`);
      total += it.quantity * it.unit_cost;
    }
    total = round2(total); // total calculated automatically

    const purchaseId = await purchaseModel.insert(conn, supplierId, total);
    for (const it of items) {
      await purchaseModel.insertDetail(conn, purchaseId, it);
      await stockModel.increase(conn, it.fruit_id, it.packaging_size, it.quantity);
    }
    return purchaseModel.findById(purchaseId, conn);
  });
  res.status(201).json({ success: true, message: 'Purchase recorded and stock updated',
    data: { ...purchase, trip: estimateTrip(purchase.latitude, purchase.longitude) } });
});

exports.getAll = asyncHandler(async (req, res) => {
  const data = await purchaseModel.findAll();
  res.status(200).json({ success: true, count: data.length, data });
});
exports.getOne = asyncHandler(async (req, res) => {
  const p = await purchaseModel.findById(req.params.id);
  if (!p) throw new HttpError(404, `Purchase ${req.params.id} not found`);
  res.status(200).json({ success: true, data: { ...p, trip: estimateTrip(p.latitude, p.longitude) } });
});

// Restock trip planner: finds low stock, picks the best supplier per line (price + trip cost), plans ONE trip
// GET /api/purchases/restock-plan?threshold=10&target=30
exports.restockPlan = asyncHandler(async (req, res) => {
  const threshold = req.query.threshold !== undefined ? Number(req.query.threshold) : Number(process.env.LOW_STOCK_THRESHOLD) || 10;
  const target = req.query.target !== undefined ? Number(req.query.target) : 30;
  if (!Number.isInteger(threshold) || threshold < 0) throw new HttpError(400, 'threshold must be a whole number >= 0');
  if (!Number.isInteger(target) || target <= threshold) throw new HttpError(400, 'target must be a whole number greater than threshold');

  const low = await stockModel.findLow(threshold);
  const suppliers = (await supplierModel.findAll()).filter((s) => s.latitude != null);
  const costs = await purchaseModel.lastCostMap();

  const groups = new Map();
  const unsourced = [];
  for (const row of low) {
    const need = target - row.available_quantity;
    let best = null;
    for (const s of suppliers) {
      const cost = costs.get(`${s.supplier_id}|${row.fruit_id}|${row.packaging_size}`);
      if (cost === undefined) continue;
      const landed = cost + estimateTrip(s.latitude, s.longitude).trip_cost / need;
      if (!best || landed < best.landed) best = { s, cost, landed };
    }
    if (!best) { unsourced.push({ fruit_name: row.fruit_name, packaging_size: row.packaging_size, available: row.available_quantity }); continue; }
    if (!groups.has(best.s.supplier_id)) {
      groups.set(best.s.supplier_id, { supplier_id: best.s.supplier_id, business_name: best.s.business_name, province: best.s.province,
        latitude: best.s.latitude, longitude: best.s.longitude, lines: [], goods_cost: 0 });
    }
    const g = groups.get(best.s.supplier_id);
    const line_cost = round2(need * best.cost);
    g.lines.push({ fruit_id: row.fruit_id, fruit_name: row.fruit_name, packaging_size: row.packaging_size,
      available: row.available_quantity, buy_boxes: need, unit_cost: best.cost, line_cost });
    g.goods_cost = round2(g.goods_cost + line_cost);
  }
  const route = planSupplierRoute([...groups.values()]);
  const goods_cost = round2([...groups.values()].reduce((a, g) => a + g.goods_cost, 0));
  res.status(200).json({ success: true, data: { threshold, target, route, goods_cost, trip_cost: route.trip_cost,
    grand_total: round2(goods_cost + route.trip_cost), unsourced } });
});
