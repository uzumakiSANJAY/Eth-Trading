const signalService = require('../services/signal.service');

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
}

module.exports = new SignalsController();
