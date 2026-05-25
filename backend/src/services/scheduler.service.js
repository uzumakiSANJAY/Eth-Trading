const cron = require('node-cron');
const axios = require('axios');
const marketService = require('./market.service');
const analysisService = require('./analysis.service');
const patternService = require('./pattern.service');
const signalService = require('./signal.service');
const multiTimeframeService = require('./multiTimeframe.service');
const dailyReviewService = require('./dailyReview.service');
const paperTradingService = require('./paperTrading.service');
const logger = require('../utils/logger');

let _autoInterval = null;
let _io = null;

async function _runAutoAnalysis() {
  try {
    logger.info('[Auto] Running 20s analysis cycle…');

    // 1. Refresh 1h candles + indicators so signals are based on fresh data
    await marketService.fetchAndStoreOhlcv('ETH/USDT', '1h', 100);
    await analysisService.calculateAndStoreIndicators('ETHUSDT', '1h');
    await patternService.detectAndStorePatterns('ETHUSDT', '1h');

    // 2. Run the three main features in parallel (each uses Redis cache where available)
    const [signalResult, mtfResult, reviewResult] = await Promise.allSettled([
      signalService.generateSignal('ETHUSDT', '1h'),
      multiTimeframeService.analyzeMultiTimeframe('ETHUSDT'),
      dailyReviewService.getDailyReview('ETHUSDT', '1h'),
    ]);

    const signal      = signalResult.status  === 'fulfilled' ? signalResult.value  : null;
    const mtfAnalysis = mtfResult.status     === 'fulfilled' ? mtfResult.value     : null;
    const dailyReview = reviewResult.status  === 'fulfilled' ? reviewResult.value  : null;

    // 3. Paper trading: only monitor SL/TP on open positions (no auto-execution)
    let paperPortfolio = null;
    try {
      let currentPrice = null;
      try { currentPrice = await marketService.getCurrentPrice('ETH/USDT'); } catch (_) {}
      if (!currentPrice) currentPrice = signal?.entryPrice ?? null;
      if (currentPrice) {
        await paperTradingService.manageOpenTrades('ETHUSDT', currentPrice);
      }
      paperPortfolio = await paperTradingService.getPortfolio('ETHUSDT', currentPrice);
    } catch (paperErr) {
      logger.warn(`[Auto] Paper trading cycle error: ${paperErr.message}`);
    }

    const payload = {
      timestamp: Date.now(),
      signal,
      mtfAnalysis,
      dailyReview,
      paperPortfolio,
      errors: {
        signal:      signalResult.status  === 'rejected' ? signalResult.reason?.message  : null,
        mtfAnalysis: mtfResult.status     === 'rejected' ? mtfResult.reason?.message     : null,
        dailyReview: reviewResult.status  === 'rejected' ? reviewResult.reason?.message  : null,
      },
    };

    // 4. Broadcast everything to all connected frontend clients
    if (_io) {
      _io.emit('auto_update', payload);
    }

    logger.info(`[Auto] Cycle complete — signal: ${payload.signal?.signalType ?? 'n/a'} | paper equity: $${paperPortfolio?.totalEquity ?? '?'}`);
  } catch (err) {
    logger.error(`[Auto] Analysis cycle error: ${err.message}`);
  }
}

function startAutoAnalysis(io) {
  _io = io;
  if (_autoInterval) return; // already running
  _autoInterval = setInterval(_runAutoAnalysis, 20_000);
  logger.info('[Auto] 20-second auto-analysis started');
  // Run immediately on startup so the frontend gets data right away
  _runAutoAnalysis();
}

function stopAutoAnalysis() {
  if (_autoInterval) {
    clearInterval(_autoInterval);
    _autoInterval = null;
    logger.info('[Auto] 20-second auto-analysis stopped');
  }
}

function startScheduledJobs(io) {
  if (io) startAutoAnalysis(io);
  cron.schedule('* * * * *', async () => {
    try {
      await marketService.fetchAndStoreOhlcv('ETH/USDT', '1m', 100);
    } catch (error) {
      logger.error('1m data fetch failed:', error.message);
    }
  });

  cron.schedule('*/5 * * * *', async () => {
    try {
      await marketService.fetchAndStoreOhlcv('ETH/USDT', '5m', 100);
    } catch (error) {
      logger.error('5m data fetch failed:', error.message);
    }
  });

  cron.schedule('*/15 * * * *', async () => {
    try {
      await marketService.fetchAndStoreOhlcv('ETH/USDT', '15m', 100);
    } catch (error) {
      logger.error('15m data fetch failed:', error.message);
    }
  });

  cron.schedule('0 * * * *', async () => {
    try {
      await marketService.fetchAndStoreOhlcv('ETH/USDT', '1h', 100);
      await analysisService.calculateAndStoreIndicators('ETHUSDT', '1h');
      await patternService.detectAndStorePatterns('ETHUSDT', '1h');
    } catch (error) {
      logger.error('1h data fetch and analysis failed:', error.message);
    }
  });

  cron.schedule('0 */4 * * *', async () => {
    try {
      await marketService.fetchAndStoreOhlcv('ETH/USDT', '4h', 100);
      await analysisService.calculateAndStoreIndicators('ETHUSDT', '4h');
      await patternService.detectAndStorePatterns('ETHUSDT', '4h');
    } catch (error) {
      logger.error('4h data fetch and analysis failed:', error.message);
    }
  });

  cron.schedule('0 0 * * *', async () => {
    try {
      await marketService.fetchAndStoreOhlcv('ETH/USDT', '1d', 100);
      await analysisService.calculateAndStoreIndicators('ETHUSDT', '1d');
      await patternService.detectAndStorePatterns('ETHUSDT', '1d');
    } catch (error) {
      logger.error('1d data fetch and analysis failed:', error.message);
    }
  });

  // Collect Reddit sentiment data daily at 6 AM UTC for ML training pipeline
  cron.schedule('0 6 * * *', async () => {
    try {
      const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001';
      const res = await axios.post(`${mlUrl}/sentiment/collect`, {}, { timeout: 30000 });
      logger.info(`Daily sentiment collection: ${res.data.inserted} samples added`);
    } catch (error) {
      logger.warn(`Daily sentiment collection failed: ${error.message}`);
    }
  });

  // Auto-retrain sentiment model every Sunday at 3 AM UTC (once enough data accumulates)
  cron.schedule('0 3 * * 0', async () => {
    try {
      const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001';
      const info = await axios.get(`${mlUrl}/sentiment/info`, { timeout: 5000 });
      if (info.data.ready_to_train) {
        const res = await axios.post(`${mlUrl}/sentiment/train`, {}, { timeout: 60000 });
        logger.info(`Weekly sentiment model retrain: accuracy=${res.data.training_result?.accuracy}`);
      } else {
        logger.info(`Sentiment model not ready to train yet: ${info.data.training_data?.total} samples`);
      }
    } catch (error) {
      logger.warn(`Weekly sentiment retrain failed: ${error.message}`);
    }
  });

  logger.info('Scheduled jobs started successfully');
}

module.exports = { startScheduledJobs, startAutoAnalysis, stopAutoAnalysis };
