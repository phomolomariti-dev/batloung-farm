class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const notFound = (req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });

const CONNECTION_CODES = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST',
  'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ECONNRESET', 'EAI_AGAIN', 'ER_CON_COUNT_ERROR'];

// Central error handler: turns any error into a meaningful JSON response (app never crashes)
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message, details: err.details });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body contains invalid JSON' });
  }
  if (CONNECTION_CODES.includes(err.code)) {
    console.error('[db] connection problem:', err.code, err.message);
    return res.status(503).json({ success: false, message: 'Database is unavailable. Please try again shortly.' });
  }
  switch (err.code) {
    case 'ER_DUP_ENTRY':
      return res.status(409).json({ success: false, message: 'A record with the same unique value (name or phone) already exists' });
    case 'ER_ROW_IS_REFERENCED_2':
      return res.status(409).json({ success: false, message: 'Cannot delete: other records depend on this one' });
    case 'ER_NO_REFERENCED_ROW_2':
      return res.status(400).json({ success: false, message: 'Referenced record does not exist' });
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
      return res.status(400).json({ success: false, message: 'Value rejected by a database constraint (e.g. negative stock)' });
    default:
      console.error('[error]', err);
      return res.status(500).json({ success: false, message: 'Unexpected server error' });
  }
}

module.exports = { HttpError, asyncHandler, notFound, errorHandler };
