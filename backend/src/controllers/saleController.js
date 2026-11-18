const { withTransaction } = require('../config/db');
const vendorModel = require('../models/vendorModel');
const fruitModel = require('../models/fruitModel');
const stockModel = require('../models/stockModel');
const saleModel = require('../models/saleModel');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');
const { validateItems, mergeItems, round2, paymentStatus } = require('../utils/helpers');
const { estimateFromDepot, planRoute } = require('../utils/geo');

// adds the clock time the delivery should arrive (now + travel + handling)
const withArrival = (e) => (e ? { ...e, arrives_at: new Date(Date.now() + e.eta_minutes * 60000).toISOString() } : null);

const METHODS = ['CASH', 'MOBILE_MONEY', 'CREDIT'];

exports.create = asyncHandler(async (req, res) => {
  const vendorId = Number(req.body.vendor_id);
  if (!Number.isInteger(vendorId) || vendorId <= 0) throw new HttpError(400, 'vendor_id must be a positive integer');
  const items = mergeItems(validateItems(req.body.items));

  const method = String(req.body.payment_method || 'CREDIT').toUpperCase();
  if (!METHODS.includes(method)) throw new HttpError(400, `payment_method must be one of ${METHODS.join(', ')}`);
  if (req.body.amount_paid !== undefined && !(Number(req.body.amount_paid) >= 0)) throw new HttpError(400, 'amount_paid must be 0 or more');
  if (method === 'CREDIT' && Number(req.body.amount_paid) > 0) throw new HttpError(400, 'CREDIT sales cannot have amount_paid; use CASH or MOBILE_MONEY');

  const sale = await withTransaction(async (conn) => {
    const vendor = await vendorModel.findById(vendorId, conn);
    if (!vendor) throw new HttpError(404, `Vendor ${vendorId} not found`);

    // Validate EVERY item first. One failure throws -> ROLLBACK -> nothing is saved, no stock is touched.
    const lines = [];
    let total = 0;
    for (const it of items) {
      const fruit = await fruitModel.findById(it.fruit_id, conn);
      if (!fruit) throw new HttpError(400, `Fruit ${it.fruit_id} does not exist`);
      if (fruit.status !== 'ACTIVE') throw new HttpError(400, `${fruit.fruit_name} is INACTIVE and cannot be sold`);
      const unit_price = await fruitModel.getPrice(conn, it.fruit_id, it.packaging_size);
      if (unit_price == null) throw new HttpError(400, `No selling price set for ${fruit.fruit_name} (${it.packaging_size})`);
      const available = await stockModel.lockRow(conn, it.fruit_id, it.packaging_size);
      if (available < it.quantity) {
        throw new HttpError(400,
          `Insufficient stock: requested ${it.quantity} ${it.packaging_size} box(es) of ${fruit.fruit_name}, only ${available} available. Sale rejected.`,
          { fruit_id: it.fruit_id, packaging_size: it.packaging_size, requested: it.quantity, available });
      }
      total += it.quantity * unit_price;
      lines.push({ ...it, unit_price });
    }
    total = round2(total); // total calculated automatically from price table

    let paid = method === 'CREDIT' ? 0 : (req.body.amount_paid !== undefined ? round2(Number(req.body.amount_paid)) : total);
    if (paid > total) throw new HttpError(400, `amount_paid (${paid}) is more than the sale total (${total})`);

    const saleId = await saleModel.insert(conn, {
      vendor_id: vendorId, payment_status: paymentStatus(total, paid), payment_method: method,
      total_amount: total, amount_paid: paid,
    });
    for (const l of lines) {
      await saleModel.insertDetail(conn, saleId, l);
      if (!(await stockModel.decrease(conn, l.fruit_id, l.packaging_size, l.quantity))) {
        throw new HttpError(400, 'Stock changed while processing the sale. Please retry.');
      }
    }
    if (paid > 0) await saleModel.insertPayment(conn, saleId, method, paid);
    return saleModel.findById(saleId, conn);
  });

  res.status(201).json({ success: true, message: 'Sale recorded and stock reduced',
    data: { ...sale, delivery: withArrival(estimateFromDepot(sale.latitude, sale.longitude)) } });
});

// Record an extra payment on an existing sale (cash or mobile money)
exports.addPayment = asyncHandler(async (req, res) => {
  const method = String(req.body.method || '').toUpperCase();
  const amountValue = Number(req.body.amount);
  if (!Number.isFinite(amountValue)) throw new HttpError(400, 'Payment amount must be a valid number');
  const amount = round2(amountValue);
  if (!['CASH', 'MOBILE_MONEY'].includes(method)) throw new HttpError(400, 'method must be CASH or MOBILE_MONEY');
  if (!(amount > 0)) throw new HttpError(400, 'amount must be greater than 0');

  const sale = await withTransaction(async (conn) => {
    const s = await saleModel.lockById(conn, req.params.id);
    if (!s) throw new HttpError(404, `Sale ${req.params.id} not found`);
    const outstanding = round2(Number(s.total_amount) - Number(s.amount_paid));
    if (outstanding <= 0) throw new HttpError(400, 'This sale is already fully paid');
    if (amount > outstanding) throw new HttpError(400, `Payment of ${amount} exceeds the outstanding balance of ${outstanding}`);
    const newPaid = round2(Number(s.amount_paid) + amount);
    await saleModel.insertPayment(conn, s.sale_id, method, amount);
    await saleModel.updatePayment(conn, s.sale_id, newPaid, paymentStatus(s.total_amount, newPaid));
    return saleModel.findById(s.sale_id, conn);
  });
  res.status(200).json({ success: true, message: 'Payment recorded', data: sale });
});

exports.getAll = asyncHandler(async (req, res) => {
  const data = await saleModel.findAll();
  res.status(200).json({ success: true, count: data.length, data });
});
exports.getOne = asyncHandler(async (req, res) => {
  const s = await saleModel.findById(req.params.id);
  if (!s) throw new HttpError(404, `Sale ${req.params.id} not found`);
  res.status(200).json({ success: true, data: { ...s, delivery: withArrival(estimateFromDepot(s.latitude, s.longitude)) } });
});

// PATCH /api/sales/:id/delivery  {"status":"DELIVERED"}
exports.setDelivery = asyncHandler(async (req, res) => {
  const status = String(req.body.status || '').toUpperCase();
  if (!['PENDING', 'DELIVERED'].includes(status)) throw new HttpError(400, 'status must be PENDING or DELIVERED');
  if (!(await saleModel.findById(req.params.id))) throw new HttpError(404, `Sale ${req.params.id} not found`);
  await saleModel.setDelivery(req.params.id, status);
  res.status(200).json({ success: true, message: `Delivery marked ${status}`, data: await saleModel.findById(req.params.id) });
});

// Orders still to be delivered + the best route to deliver them (one stop per vendor)
exports.pending = asyncHandler(async (req, res) => {
  const orders = await saleModel.pending();
  const byVendor = new Map();
  orders.forEach((o) => {
    if (!byVendor.has(o.vendor_id)) byVendor.set(o.vendor_id, { vendor_id: o.vendor_id, vendor_name: o.vendor_name, location: o.location,
      latitude: o.latitude, longitude: o.longitude, orders: 0, order_total: 0, outstanding_balance: 0 });
    const g = byVendor.get(o.vendor_id);
    g.orders += 1; g.order_total = round2(g.order_total + o.total_amount); g.outstanding_balance = round2(g.outstanding_balance + o.outstanding_balance);
  });
  const stops = [...byVendor.values()];
  res.status(200).json({ success: true, count: orders.length,
    data: { orders, route: planRoute(stops), skipped_without_coordinates: stops.filter((s) => s.latitude == null).map((s) => s.vendor_name) } });
});
