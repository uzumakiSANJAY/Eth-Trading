const signalService = require('../services/signal.service');
const newsService = require('../services/news.service');

class SignalsController {
  async generateSignal(req, res, next) {
    try {
      const { symbol = 'ETHUSDT', timeframe = '1h' } = req.body;
      const signal = await signalService.generateSignal(symbol, timeframe);
      res.json({
        success: true,
        data: signal,
      });
    } catch (error) {
      next(error);
    }
  }

  async getLatestSignal(req, res, next) {
    try {
      const { symbol = 'ETHUSDT', timeframe = '1h' } = req.query;
      const signal = await signalService.getLatestSignal(symbol, timeframe);
      res.json({
        success: true,
        data: signal,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSignalHistory(req, res, next) {
    try {
      const { symbol = 'ETHUSDT', timeframe = '1h', limit = 50 } = req.query;
      const signals = await signalService.getSignalHistory(
        symbol,
        timeframe,
        parseInt(limit)
      );
      res.json({
        success: true,
        data: {
          symbol,
          timeframe,
          count: signals.length,
          signals,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getNewsSentiment(req, res, next) {
    try {
      const sentiment = await newsService.getNewsSentiment();
      res.json({ success: true, data: sentiment });
    } catch (error) {
      next(error);
    }
  }

  async getDailyStats(req, res, next) {
    try {
      const { symbol = 'ETHUSDT' } = req.query;
      const riskManager = require('../services/riskManager.service');
      const stats = await riskManager.getDailyStats(symbol);
      res.json({ success: true, data: stats });
    } catch (error) { next(error); }
  }

  async getMarketIntel(req, res, next) {
    try {
      const { symbol = 'ETHUSDT' } = req.query;
      const marketIntelService = require('../services/marketIntel.service');
      const intel = await marketIntelService.getAllIntel(symbol);
      res.json({ success: true, data: intel });
    } catch (error) { next(error); }
  }

  async getRedditSentiment(req, res, next) {
    try {
      const redditService = require('../services/reddit.service');
      const data = await redditService.getSentiment();
      res.json({ success: true, data });
    } catch (error) { next(error); }
  }

  async getOnchainData(req, res, next) {
    try {
      const { symbol = 'ETHUSDT' } = req.query;
      const onchainService = require('../services/onchain.service');
      const data = await onchainService.getAllOnchain(symbol);
      res.json({ success: true, data });
    } catch (error) { next(error); }
  }
}

module.exports = new SignalsController();
