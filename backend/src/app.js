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

fs.mkdirSync(path.join(process.cwd(), 'logs'), { recursive: true });

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  })
);

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
