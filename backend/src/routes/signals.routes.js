const express = require('express');
const signalsController = require('../controllers/signals.controller');

const router = express.Router();

router.post('/generate', signalsController.generateSignal);
router.get('/latest', signalsController.getLatestSignal);
router.get('/history', signalsController.getSignalHistory);

module.exports = router;
