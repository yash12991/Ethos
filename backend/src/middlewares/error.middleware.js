const logger = require('../utils/logger');

class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function notFoundMiddleware(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

function errorMiddleware(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  logger.error('Unhandled API error', {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    message: err.message,
    stack: err.stack,
    details: err.details,
  });

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'production' ? undefined : err.details,
  });
}

module.exports = {
  ApiError,
  notFoundMiddleware,
  errorMiddleware,
};
