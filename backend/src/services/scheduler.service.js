const cron = require('node-cron');
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

  logger.info('Scheduled jobs started successfully');
}

module.exports = { startScheduledJobs };
