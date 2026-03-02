const { RateLimiterMemory } = require('rate-limiter-flexible');
const { ApiError } = require('./error.middleware');

const authLimiter = new RateLimiterMemory({ points: 8, duration: 60, blockDuration: 300 });
const complaintLimiter = new RateLimiterMemory({ points: 20, duration: 60 });
const uploadLimiter = new RateLimiterMemory({ points: 10, duration: 60 });

function buildLimiter(limiter, keySelector) {
  return async (req, res, next) => {
    const key = keySelector(req);

    try {
      await limiter.consume(key);
      return next();
    } catch (rejRes) {
      return next(
        new ApiError(429, 'Too many requests', {
          retryAfterSec: Math.ceil((rejRes.msBeforeNext || 1000) / 1000),
        })
      );
    }
  };
}

module.exports = {
  authRateLimit: buildLimiter(authLimiter, (req) => `auth:${req.ip}`),
  complaintRateLimit: buildLimiter(complaintLimiter, (req) => `complaint:${req.user?.id || req.ip}`),
  uploadRateLimit: buildLimiter(uploadLimiter, (req) => `upload:${req.user?.id || req.ip}`),
};
