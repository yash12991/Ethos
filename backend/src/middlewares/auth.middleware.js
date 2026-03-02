const { verifyAccessToken } = require('../config/jwt');
const { ApiError } = require('./error.middleware');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Missing or invalid Authorization header'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      alias: payload.alias,
      userType: payload.userType || (payload.role === 'reporter' ? 'anon' : 'hr'),
    };
    req.accessToken = token;
    return next();
  } catch (err) {
    return next(new ApiError(401, 'Invalid or expired token'));
  }
}

module.exports = authMiddleware;
