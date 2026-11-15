const stockModel = require('../models/stockModel');
const fruitModel = require('../models/fruitModel');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');

exports.getAll = asyncHandler(async (req, res) => {
  const data = await stockModel.findAll();
  res.status(200).json({ success: true, count: data.length, data });
});
exports.getLow = asyncHandler(async (req, res) => {
  const threshold = req.query.threshold !== undefined ? Number(req.query.threshold) : Number(process.env.LOW_STOCK_THRESHOLD) || 10;
  if (!Number.isInteger(threshold) || threshold < 0) throw new HttpError(400, 'threshold must be a whole number >= 0');
  const data = await stockModel.findLow(threshold);
  res.status(200).json({ success: true, threshold, count: data.length, data });
});
exports.getByFruit = asyncHandler(async (req, res) => {
  if (!(await fruitModel.findById(req.params.id))) throw new HttpError(404, `Fruit ${req.params.id} not found`);
  res.status(200).json({ success: true, data: await stockModel.findByFruit(req.params.id) });
});
