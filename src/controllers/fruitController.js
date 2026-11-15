const fruitModel = require('../models/fruitModel');
const { withTransaction } = require('../config/db');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');
const { SIZES } = require('../middleware/validate');

function checkPrices(prices) {
  if (prices === undefined) return;
  if (typeof prices !== 'object' || prices === null) throw new HttpError(400, 'prices must be an object like {"small":60,"medium":90,"large":120}');
  for (const [size, v] of Object.entries(prices)) {
    if (!SIZES.includes(size)) throw new HttpError(400, `Unknown packaging size "${size}"`);
    if (!(Number(v) > 0)) throw new HttpError(400, `Price for ${size} must be greater than 0`);
  }
  const vals = SIZES.filter((s) => prices[s] !== undefined).map((s) => Number(prices[s]));
  if (new Set(vals).size !== vals.length) throw new HttpError(400, 'Each packaging size must have a different selling price');
}

exports.create = asyncHandler(async (req, res) => {
  checkPrices(req.body.prices);
  if (req.body.status && !['ACTIVE', 'INACTIVE'].includes(req.body.status)) throw new HttpError(400, 'status must be ACTIVE or INACTIVE');
  const id = await withTransaction((conn) => fruitModel.create(conn, req.body));
  res.status(201).json({ success: true, message: 'Fruit registered', data: await fruitModel.findById(id) });
});
exports.getAll = asyncHandler(async (req, res) => {
  const data = await fruitModel.findAll(req.query.status === 'all');
  res.status(200).json({ success: true, count: data.length, data });
});
exports.getOne = asyncHandler(async (req, res) => {
  const f = await fruitModel.findById(req.params.id);
  if (!f) throw new HttpError(404, `Fruit ${req.params.id} not found`);
  res.status(200).json({ success: true, data: f });
});
exports.update = asyncHandler(async (req, res) => {
  if (!(await fruitModel.findById(req.params.id))) throw new HttpError(404, `Fruit ${req.params.id} not found`);
  if (req.body.status && !['ACTIVE', 'INACTIVE'].includes(req.body.status)) throw new HttpError(400, 'status must be ACTIVE or INACTIVE');
  const { prices } = req.body;
  checkPrices(prices);
  await withTransaction(async (conn) => {
    const { fruit_name, description, status } = req.body;
    if (fruit_name !== undefined || description !== undefined || status !== undefined) {
      await fruitModel.update(req.params.id, { fruit_name, description, status });
    }
    if (prices) await fruitModel.setPrices(conn, req.params.id, prices);
  });
  res.status(200).json({ success: true, message: 'Fruit updated', data: await fruitModel.findById(req.params.id) });
});
