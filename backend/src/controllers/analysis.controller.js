const analysisService = require('../services/analysis.service');

class AnalysisController {
  async getIndicators(req, res, next) {
    try {
      const { symbol = 'ETHUSDT', timeframe = '1h' } = req.query;
      const indicators = await analysisService.getLatestIndicators(symbol, timeframe);
      const analysis = await analysisService.analyzeIndicators(indicators);

      res.json({
        success: true,
        data: {
          symbol,
          timeframe,
          indicators,
          analysis,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async calculateIndicators(req, res, next) {
    try {
      const { symbol = 'ETHUSDT', timeframe = '1h' } = req.query;
      const indicators = await analysisService.calculateAndStoreIndicators(
        symbol,
        timeframe
      );
      res.json({
        success: true,
        message: 'Indicators calculated successfully',
        data: indicators,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AnalysisController();
