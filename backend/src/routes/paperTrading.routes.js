const express = require('express');
const c = require('../controllers/paperTrading.controller');

const router = express.Router();

router.get('/portfolio',        c.getPortfolio);   // GET  /api/paper/portfolio?symbol=ETHUSDT
router.post('/deposit',         c.deposit);        // POST /api/paper/deposit  { symbol, amount }
router.post('/trade',           c.openTrade);      // POST /api/paper/trade    { symbol, direction, entryPrice, sizeUSD, stopLoss, takeProfit1 }
router.post('/close/:tradeId',  c.closeTrade);     // POST /api/paper/close/:id { symbol }
router.post('/reset',           c.resetAccount);   // POST /api/paper/reset    { symbol }

module.exports = router;
