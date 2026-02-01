require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
const logger = require('./utils/logger');
const { sequelize } = require('./database/config/database');
const { initRedis } = require('./database/config/redis');
const marketRoutes = require('./routes/market.routes');
const analysisRoutes = require('./routes/analysis.routes');
const patternsRoutes = require('./routes/patterns.routes');
const signalsRoutes = require('./routes/signals.routes');
const errorHandler = require('./middleware/error-handler');
const { initWebSocket } = require('./websocket/websocket-server');
const { startScheduledJobs } = require('./services/scheduler.service');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
});

const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use('/api/market', marketRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/patterns', patternsRoutes);
app.use('/api/signals', signalsRoutes);

app.use(errorHandler);

async function startServer() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    logger.info('Database synchronized');

    await initRedis();
    logger.info('Redis connection established');

    initWebSocket(io);
    logger.info('WebSocket initialized');

    startScheduledJobs();
    logger.info('Scheduled jobs started');

    server.listen(PORT, () => {
      logger.info(`🚀 Backend API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await sequelize.close();
  server.close(() => {
    logger.info('HTTP server closed');
  });
});

startServer();

module.exports = { app, server, io };
