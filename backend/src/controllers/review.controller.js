const dailyReviewService = require('../services/dailyReview.service');

class ReviewController {
  async getDailyReview(req, res, next) {
    try {
      const { symbol = 'ETHUSDT', timeframe = '1h' } = req.query;
      const review = await dailyReviewService.getDailyReview(symbol, timeframe);
      res.json({ success: true, data: review });
    } catch (error) {
      next(error);
    }
  }

  async getBreakouts(req, res, next) {
    try {
      const { symbol = 'ETHUSDT', timeframe = '1h' } = req.query;
      const review = await dailyReviewService.getDailyReview(symbol, timeframe);
      res.json({
        success: true,
        data: {
          symbol,
          timeframe,
          date: review.date,
          breakouts: review.breakouts,
          supportResistance: review.supportResistance,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getMissedOpportunities(req, res, next) {
    try {
      const { symbol = 'ETHUSDT', timeframe = '1h' } = req.query;
      const review = await dailyReviewService.getDailyReview(symbol, timeframe);
      res.json({
        success: true,
        data: {
          symbol,
          timeframe,
          date: review.date,
          missedOpportunities: review.missedOpportunities,
          lossOptimization: review.lossOptimization,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReviewController();
