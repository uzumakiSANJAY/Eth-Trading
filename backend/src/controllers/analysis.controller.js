const analysisService = require('../services/analysis.service');
const multiTimeframeService = require('../services/multiTimeframe.service');

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

  async getMultiTimeframeAnalysis(req, res, next) {
    try {
      const { symbol = 'ETHUSDT' } = req.query;
      const result = await multiTimeframeService.analyzeMultiTimeframe(symbol);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AnalysisController();
