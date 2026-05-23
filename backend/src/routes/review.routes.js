const express = require('express');
const reviewController = require('../controllers/review.controller');
const { startAutoAnalysis, stopAutoAnalysis } = require('../services/scheduler.service');

const router = express.Router();

// GET /api/review/daily?symbol=ETHUSDT&timeframe=1h
router.get('/daily', reviewController.getDailyReview);

// GET /api/review/breakouts?symbol=ETHUSDT&timeframe=1h
router.get('/breakouts', reviewController.getBreakouts);

// GET /api/review/missed?symbol=ETHUSDT&timeframe=1h
router.get('/missed', reviewController.getMissedOpportunities);

// POST /api/review/auto { action: 'start' | 'stop' }
router.post('/auto', (req, res) => {
  const { action } = req.body;
  if (action === 'stop') {
    stopAutoAnalysis();
    return res.json({ success: true, autoAnalysis: false });
  }
  startAutoAnalysis();
  res.json({ success: true, autoAnalysis: true });
});

module.exports = router;
