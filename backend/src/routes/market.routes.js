const express = require('express');
const marketController = require('../controllers/market.controller');

const router = express.Router();

router.get('/price', marketController.getCurrentPrice);
router.get('/ohlcv', marketController.getOhlcvData);
router.get('/volume', marketController.getVolumeAnalysis);
router.get('/24h-stats', marketController.get24hStats);
router.post('/fetch', marketController.fetchFreshData);

module.exports = router;
