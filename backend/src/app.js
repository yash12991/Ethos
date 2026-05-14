require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const authRoutes = require('./routes/auth.routes');
const complaintRoutes = require('./routes/complaint.routes');
const evidenceRoutes = require('./routes/evidence.routes');
const chatRoutes = require('./routes/chat.routes');
const hrRoutes = require('./routes/hr.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const supportChatRoutes = require('./routes/supportChat.routes');
const logger = require('./utils/logger');
const { notFoundMiddleware, errorMiddleware } = require('./middlewares/error.middleware');

const app = express();
const apiPrefix = process.env.API_PREFIX || '/api/v1';
const defaultClientOrigins = ['http://localhost:3000', 'https://ethos-seven-nu.vercel.app','https://ethos-ivory.vercel.app'];
const configuredClientOrigins = (process.env.CLIENT_ORIGIN || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const clientOrigins = configuredClientOrigins.length ? configuredClientOrigins : defaultClientOrigins;

fs.mkdirSync(path.join(process.cwd(), 'logs'), { recursive: true });

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS: use a callback so we can log decisions and ensure headers are set
app.use(
  cors({
    origin(origin, callback) {
      // allow requests with no origin (e.g., server-to-server or curl)
      const allowed = !origin || clientOrigins.includes(origin);
      logger.debug('CORS origin check', { origin, allowed, clientOrigins });
      // callback signature: (err, allowed)
      return callback(null, allowed);
    },
    credentials: true,
  })
);

// Safety: ensure Access-Control-Allow-Origin is present for allowed origins
// even in error paths (helps when other middleware/handlers respond early).
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && clientOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

// Explicitly handle OPTIONS preflight with the same CORS policy and log
app.options('*', (req, res, next) => {
  const origin = req.headers.origin;
  logger.debug('OPTIONS preflight received', { path: req.path, origin });
  // Delegate to cors middleware to set proper headers
  cors({
    origin(originValue, callback) {
      const allowed = !originValue || clientOrigins.includes(originValue);
      return callback(null, allowed);
    },
    credentials: true,
  })(req, res, next);
});

// Log responses that do not include CORS headers when an Origin was present
app.use((req, res, next) => {
  res.on('finish', () => {
    const origin = req.headers.origin;
    if (origin) {
      const aca = res.getHeader('Access-Control-Allow-Origin');
      if (!aca) {
        logger.warn('Response missing CORS header for origin', {
          origin,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
        });
      }
    }
  });
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'anonymous-reporting-api',
    timestamp: new Date().toISOString(),
  });
});

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/complaints`, complaintRoutes);
app.use(`${apiPrefix}/evidence`, evidenceRoutes);
app.use(`${apiPrefix}/chat`, chatRoutes);
app.use(`${apiPrefix}/hr`, hrRoutes);
app.use('/api/hr', hrRoutes);
app.use(`${apiPrefix}/analytics`, analyticsRoutes);
app.use(`${apiPrefix}/support-chat`, supportChatRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
