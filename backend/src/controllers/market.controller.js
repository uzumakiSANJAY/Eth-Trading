const marketService = require('../services/market.service');

class MarketController {
  async getCurrentPrice(req, res, next) {
    try {
      const { symbol = 'ETH/USDT' } = req.query;
      const price = await marketService.getCurrentPrice(symbol);
      res.json({
        success: true,
        data: {
          symbol,
          price,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getOhlcvData(req, res, next) {
    try {
      const { symbol = 'ETHUSDT', timeframe = '1h', limit = 100 } = req.query;
      const data = await marketService.getHistoricalData(
        symbol,
        timeframe,
        Math.max(1, Math.min(1000, parseInt(limit, 10) || 100))
      );
      res.json({
        success: true,
        data: {
          symbol,
          timeframe,
          count: data.length,
          candles: data,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getVolumeAnalysis(req, res, next) {
    try {
      const { symbol = 'ETHUSDT', timeframe = '1h', candles = 24 } = req.query;
      const volumeData = await marketService.getVolumeAnalysis(
        symbol,
        timeframe,
        Math.max(1, Math.min(500, parseInt(candles, 10) || 24))
      );
      res.json({
        success: true,
        data: {
          symbol,
          timeframe,
          ...volumeData,
          analysis:
            volumeData.volumeRatio > 1.5
              ? 'High volume spike detected'
              : volumeData.volumeRatio < 0.5
              ? 'Low volume detected'
              : 'Normal volume',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async get24hStats(req, res, next) {
    try {
      const { symbol = 'ETHUSDT' } = req.query;
      const stats = await marketService.get24hStats(symbol);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async fetchFreshData(req, res, next) {
    try {
      const { symbol = 'ETH/USDT', timeframe = '1h', limit = 500 } = req.query;
      await marketService.fetchAndStoreOhlcv(symbol, timeframe, Math.max(1, Math.min(1000, parseInt(limit, 10) || 500)));
      res.json({
        success: true,
        message: 'Data fetched and stored successfully',
        data: { symbol, timeframe, limit },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MarketController();
