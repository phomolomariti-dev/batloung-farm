const model = require('../models/vendorModel');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');
const { estimateFromDepot, planRoute, depot } = require('../utils/geo');

exports.create = asyncHandler(async (req, res) => {
  const id = await model.create(req.body);
  res.status(201).json({ success: true, message: 'Vendor registered', data: await model.findById(id) });
});
exports.getAll = asyncHandler(async (req, res) => {
  const data = await model.findAll();
  res.status(200).json({ success: true, count: data.length, data });
});
exports.search = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) throw new HttpError(400, 'Provide a search term: /api/vendors/search?q=name-or-phone');
  const data = await model.search(q);
  res.status(200).json({ success: true, count: data.length, data });
});
exports.getOne = asyncHandler(async (req, res) => {
  const v = await model.findById(req.params.id);
  if (!v) throw new HttpError(404, `Vendor ${req.params.id} not found`);
  res.status(200).json({ success: true, data: v });
});
exports.update = asyncHandler(async (req, res) => {
  if (!(await model.findById(req.params.id))) throw new HttpError(404, `Vendor ${req.params.id} not found`);
  await model.update(req.params.id, req.body);
  res.status(200).json({ success: true, message: 'Vendor updated', data: await model.findById(req.params.id) });
});

// Outstanding balance per vendor (?outstanding_only=true)
exports.balances = asyncHandler(async (req, res) => {
  const data = await model.balances({ outstandingOnly: req.query.outstanding_only === 'true' });
  res.status(200).json({ success: true, count: data.length, data });
});
exports.balanceOne = asyncHandler(async (req, res) => {
  const b = await model.balanceFor(req.params.id);
  if (!b) throw new HttpError(404, `Vendor ${req.params.id} not found`);
  res.status(200).json({ success: true, data: b });
});

// ---- Map + delivery time ----
exports.map = asyncHandler(async (req, res) => {
  const rows = await model.balances();
  const data = rows.map((v) => ({ ...v, delivery: estimateFromDepot(v.latitude, v.longitude) }));
  res.status(200).json({ success: true, depot: depot(), count: data.length, data });
});
exports.delivery = asyncHandler(async (req, res) => {
  const v = await model.findById(req.params.id);
  if (!v) throw new HttpError(404, `Vendor ${req.params.id} not found`);
  const delivery = estimateFromDepot(v.latitude, v.longitude);
  if (!delivery) throw new HttpError(400, 'This vendor has no map coordinates yet. Update the vendor with latitude and longitude.');
  res.status(200).json({ success: true, data: { vendor_id: v.vendor_id, vendor_name: v.vendor_name, location: v.location, ...delivery } });
});
// Delivery route for the vendors that still owe money / or ?vendor_ids=1,2,3
exports.routePlan = asyncHandler(async (req, res) => {
  const all = await model.balances();
  let stops = all;
  if (req.query.vendor_ids) {
    const ids = String(req.query.vendor_ids).split(',').map(Number);
    if (ids.some((n) => !Number.isInteger(n) || n <= 0)) throw new HttpError(400, 'vendor_ids must be comma-separated positive integers');
    stops = all.filter((v) => ids.includes(v.vendor_id));
  } else {
    stops = all.filter((v) => v.outstanding_balance > 0);
  }
  const skipped = stops.filter((s) => s.latitude == null).map((s) => s.vendor_name);
  const plan = planRoute(stops.map((s) => ({ vendor_id: s.vendor_id, vendor_name: s.vendor_name, location: s.location,
    latitude: s.latitude, longitude: s.longitude, outstanding_balance: s.outstanding_balance })));
  res.status(200).json({ success: true, skipped_without_coordinates: skipped, data: plan });
});
