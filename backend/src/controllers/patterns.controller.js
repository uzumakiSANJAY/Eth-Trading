const patternService = require('../services/pattern.service');

class PatternsController {
  async detectPatterns(req, res, next) {
    try {
      const { symbol = 'ETHUSDT', timeframe = '1h' } = req.query;
      const patterns = await patternService.detectAndStorePatterns(symbol, timeframe);
      res.json({
        success: true,
        data: {
          symbol,
          timeframe,
          patterns,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getRecentPatterns(req, res, next) {
    try {
      const { symbol = 'ETHUSDT', timeframe = '1h', limit = 10 } = req.query;
      const patterns = await patternService.getRecentPatterns(
        symbol,
        timeframe,
        parseInt(limit)
      );
      res.json({
        success: true,
        data: {
          symbol,
          timeframe,
          count: patterns.length,
          patterns,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PatternsController();
