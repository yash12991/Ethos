const { validationResult } = require('express-validator');
const { ApiError } = require('./error.middleware');

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  return next(new ApiError(422, 'Validation failed', errors.array()));
}

module.exports = {
  validateRequest,
};
