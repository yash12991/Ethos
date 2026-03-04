require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const logger = require('./utils/logger');
const { initChatSocket } = require('./socket/chat.socket');

const PORT = Number(process.env.PORT || 5000);
const defaultClientOrigins = ['http://localhost:3000', 'https://ethos-seven-nu.vercel.app'];
const configuredClientOrigins = (process.env.CLIENT_ORIGIN || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const clientOrigins = configuredClientOrigins.length ? configuredClientOrigins : defaultClientOrigins;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: clientOrigins,
    credentials: true,
  },
});

initChatSocket(io);

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', {
    message: err.message,
    stack: err.stack,
  });
});

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
