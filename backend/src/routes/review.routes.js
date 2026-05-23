const express = require('express');
const reviewController = require('../controllers/review.controller');

const router = express.Router();

// GET /api/review/daily?symbol=ETHUSDT&timeframe=1h
router.get('/daily', reviewController.getDailyReview);

// GET /api/review/breakouts?symbol=ETHUSDT&timeframe=1h
router.get('/breakouts', reviewController.getBreakouts);

// GET /api/review/missed?symbol=ETHUSDT&timeframe=1h
router.get('/missed', reviewController.getMissedOpportunities);

module.exports = router;
