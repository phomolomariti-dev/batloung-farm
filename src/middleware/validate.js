const { HttpError } = require('./errorHandler');

const SIZES = ['small', 'medium', 'large'];
const PROVINCES = ['Gauteng', 'Free State', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape',
  'Limpopo', 'Mpumalanga', 'North West'];
const PHONE_RE = /^\+?[\d\s-]{7,20}$/;

const requireFields = (fields) => (req, res, next) => {
  const body = req.body || {};
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || String(body[f]).trim() === '');
  if (missing.length) return next(new HttpError(400, `Missing required field(s): ${missing.join(', ')}`));
  next();
};

const validId = (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return next(new HttpError(400, 'ID must be a positive integer'));
  req.params.id = id;
  next();
};

const phoneCheck = (field) => (req, res, next) => {
  const v = req.body && req.body[field];
  if (v !== undefined && !PHONE_RE.test(String(v))) return next(new HttpError(400, `${field} is not a valid phone number`));
  next();
};

const provinceCheck = (req, res, next) => {
  const p = req.body && req.body.province;
  if (p !== undefined && !PROVINCES.includes(p)) {
    return next(new HttpError(400, `province must be one of: ${PROVINCES.join(', ')}`));
  }
  next();
};

const coordsCheck = (req, res, next) => {
  const { latitude: lat, longitude: lng } = req.body || {};
  if (lat !== undefined && lat !== null && !(Number(lat) >= -90 && Number(lat) <= 90)) return next(new HttpError(400, 'latitude must be between -90 and 90'));
  if (lng !== undefined && lng !== null && !(Number(lng) >= -180 && Number(lng) <= 180)) return next(new HttpError(400, 'longitude must be between -180 and 180'));
  next();
};

const noEmptyBody = (req, res, next) =>
  (!req.body || Object.keys(req.body).length === 0) ? next(new HttpError(400, 'Request body is empty')) : next();

module.exports = { SIZES, PROVINCES, requireFields, validId, phoneCheck, provinceCheck, coordsCheck, noEmptyBody };
