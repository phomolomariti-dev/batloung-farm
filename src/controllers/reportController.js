const model = require('../models/reportModel');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const send = (res, data) => res.status(200).json({ success: true, data });

exports.topFruits = asyncHandler(async (req, res) => send(res, await model.topFruits()));
exports.topVendor = asyncHandler(async (req, res) => {
  const v = await model.topVendor();
  if (!v) throw new HttpError(404, 'No sales recorded yet');
  send(res, v);
});
exports.stockLevels = asyncHandler(async (req, res) => send(res, await model.stockLevels()));
exports.revenue = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '') || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    throw new HttpError(400, 'Provide valid from and to dates in YYYY-MM-DD format');
  }
  if (from > to) throw new HttpError(400, 'from date must not be after to date');
  send(res, { from, to, ...(await model.revenue(from, to)) });
});
