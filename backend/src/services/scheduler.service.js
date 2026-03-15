const cron = require('node-cron');
const axios = require('axios');
const marketService = require('./market.service');
const analysisService = require('./analysis.service');
const patternService = require('./pattern.service');
const logger = require('../utils/logger');

function startScheduledJobs() {
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

module.exports = { startScheduledJobs };
