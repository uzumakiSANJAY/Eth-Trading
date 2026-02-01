const express = require('express');
const patternsController = require('../controllers/patterns.controller');

const router = express.Router();

router.post('/detect', patternsController.detectPatterns);
router.get('/recent', patternsController.getRecentPatterns);

module.exports = router;
