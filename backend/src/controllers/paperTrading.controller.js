const paperTradingService = require('../services/paperTrading.service');
const marketService = require('../services/market.service');

class PaperTradingController {
  async getPortfolio(req, res, next) {
    try {
      const { symbol = 'ETHUSDT' } = req.query;
      const fmt = symbol.includes('/') ? symbol : `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
      let currentPrice = null;
      try { currentPrice = await marketService.getCurrentPrice(fmt); } catch (_) {}
      res.json({ success: true, data: await paperTradingService.getPortfolio(symbol, currentPrice) });
    } catch (err) { next(err); }
  }

  async deposit(req, res, next) {
    try {
      const { symbol = 'ETHUSDT', amount } = req.body;
      if (!amount || isNaN(parseFloat(amount))) return res.status(400).json({ success: false, message: 'Invalid amount' });
      res.json({ success: true, data: await paperTradingService.deposit(symbol, amount) });
    } catch (err) { next(err); }
  }

  async openTrade(req, res, next) {
    try {
      const { symbol = 'ETHUSDT', direction, entryPrice, sizeUSD, stopLoss, takeProfit1, takeProfit2 } = req.body;
      const trade = await paperTradingService.openTrade(symbol, { direction, entryPrice, sizeUSD, stopLoss, takeProfit1, takeProfit2 });
      const fmt = symbol.includes('/') ? symbol : `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
      let currentPrice = null;
      try { currentPrice = await marketService.getCurrentPrice(fmt); } catch (_) {}
      const portfolio = await paperTradingService.getPortfolio(symbol, currentPrice);
      res.json({ success: true, data: { trade, portfolio } });
    } catch (err) {
      if (err.message.includes('Insufficient') || err.message.includes('Invalid') || err.message.includes('deposit')) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next(err);
    }
  }

  async closeTrade(req, res, next) {
    try {
      const { tradeId } = req.params;
      const { symbol = 'ETHUSDT' } = req.body;
      const fmt = symbol.includes('/') ? symbol : `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
      let currentPrice = null;
      try { currentPrice = await marketService.getCurrentPrice(fmt); } catch (_) {}
      if (!currentPrice) return res.status(400).json({ success: false, message: 'Could not fetch current price' });
      const trade = await paperTradingService.closeTrade(tradeId, currentPrice, 'Manual');
      if (!trade) return res.status(404).json({ success: false, message: 'Trade not found or already closed' });
      const portfolio = await paperTradingService.getPortfolio(symbol, currentPrice);
      res.json({ success: true, data: { trade, portfolio } });
    } catch (err) { next(err); }
  }

  async resetAccount(req, res, next) {
    try {
      const { symbol = 'ETHUSDT' } = req.body;
      res.json({ success: true, data: await paperTradingService.resetAccount(symbol) });
    } catch (err) { next(err); }
  }
}

module.exports = new PaperTradingController();
