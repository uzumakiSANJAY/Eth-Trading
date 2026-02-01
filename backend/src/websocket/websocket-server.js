const ccxt = require('ccxt');
const logger = require('../utils/logger');
const marketService = require('../services/market.service');

let priceUpdateInterval = null;

function initWebSocket(io) {
  const exchange = new ccxt.binance({
    enableRateLimit: true,
  });

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.emit('connected', {
      message: 'Connected to ETH Trading Platform',
      timestamp: Date.now(),
    });

    socket.on('subscribe', async (data) => {
      const { symbol = 'ETH/USDT', timeframe = '1h' } = data;
      logger.info(`Client ${socket.id} subscribed to ${symbol} ${timeframe}`);

      socket.join(`${symbol}_${timeframe}`);

      if (!priceUpdateInterval) {
        priceUpdateInterval = setInterval(async () => {
          try {
            const price = await marketService.getCurrentPrice('ETH/USDT');
            io.to('ETH/USDT_1h').emit('price_update', {
              symbol: 'ETHUSDT',
              price,
              timestamp: Date.now(),
            });
          } catch (error) {
            logger.error(`WebSocket price update error: ${error.message}`);
          }
        }, 5000);
      }

      try {
        const latestPrice = await marketService.getCurrentPrice(symbol);
        socket.emit('price_update', {
          symbol: symbol.replace('/', ''),
          price: latestPrice,
          timestamp: Date.now(),
        });
      } catch (error) {
        logger.error(`Failed to fetch initial price: ${error.message}`);
      }
    });

    socket.on('unsubscribe', (data) => {
      const { symbol = 'ETH/USDT', timeframe = '1h' } = data;
      logger.info(`Client ${socket.id} unsubscribed from ${symbol} ${timeframe}`);
      socket.leave(`${symbol}_${timeframe}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  logger.info('WebSocket server initialized');
}

function broadcastSignal(io, signal) {
  io.emit('new_signal', signal);
  logger.info(`Broadcasted new signal: ${signal.signalType}`);
}

function broadcastIndicatorUpdate(io, symbol, timeframe, indicators) {
  io.to(`${symbol}_${timeframe}`).emit('indicator_update', {
    symbol,
    timeframe,
    indicators,
    timestamp: Date.now(),
  });
}

module.exports = {
  initWebSocket,
  broadcastSignal,
  broadcastIndicatorUpdate,
};
