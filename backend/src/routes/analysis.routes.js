const express = require('express');
const analysisController = require('../controllers/analysis.controller');

const router = express.Router();

router.get('/indicators', analysisController.getIndicators);
router.get('/multi-timeframe', analysisController.getMultiTimeframeAnalysis);
router.post('/calculate', analysisController.calculateIndicators);

module.exports = router;
