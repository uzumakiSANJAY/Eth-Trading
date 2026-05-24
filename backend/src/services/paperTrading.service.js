const { PaperTrade, PaperAccount } = require('../models');
const logger = require('../utils/logger');

class PaperTradingService {

  // ── Get or create account ──────────────────────────────────────────────────
  async _getAccount(symbol) {
    const [account] = await PaperAccount.findOrCreate({
      where: { symbol },
      defaults: { symbol, totalDeposited: 0 },
    });
    return account;
  }

  // ── Deposit virtual funds ──────────────────────────────────────────────────
  async deposit(symbol = 'ETHUSDT', amount) {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) throw new Error('Deposit amount must be greater than 0');
    const account = await this._getAccount(symbol);
    await account.increment('totalDeposited', { by: amt });
    await account.reload();
    logger.info(`[Paper] Deposited $${amt.toFixed(2)} → total deposited: $${parseFloat(account.totalDeposited).toFixed(2)}`);
    return this.getPortfolio(symbol);
  }

  // ── Portfolio snapshot ─────────────────────────────────────────────────────
  async getPortfolio(symbol = 'ETHUSDT', currentPrice = null) {
    const account = await this._getAccount(symbol);
    const totalDeposited = parseFloat(account.totalDeposited);

    const trades = await PaperTrade.findAll({
      where: { symbol },
      order: [['createdAt', 'DESC']],
    });

    const open   = trades.filter(t => t.status === 'open');
    const closed = trades.filter(t => t.status !== 'open');

    const realizedPnL = closed.reduce((s, t) => s + parseFloat(t.pnlUSD || 0), 0);
    const effectiveBalance = totalDeposited + realizedPnL;
    const allocatedUSD = open.reduce((s, t) => s + parseFloat(t.sizeUSD || 0), 0);
    const freeBalance = Math.max(0, effectiveBalance - allocatedUSD);

    const wins   = closed.filter(t => parseFloat(t.pnlUSD || 0) > 0).length;
    const losses = closed.filter(t => parseFloat(t.pnlUSD || 0) <= 0).length;

    let unrealizedPnL = 0;
    const openFormatted = open.map(t => {
      const entry = parseFloat(t.entryPrice);
      const livePrice = parseFloat(currentPrice || entry);
      const isBuy = t.direction === 'BUY';
      const pnlPct = isBuy
        ? ((livePrice - entry) / entry) * 100
        : ((entry - livePrice) / entry) * 100;
      const pnlUSD = parseFloat(t.sizeUSD) * (pnlPct / 100);
      unrealizedPnL += pnlUSD;
      return {
        ...this._fmt(t),
        livePrice,
        livePnlPercent: parseFloat(pnlPct.toFixed(2)),
        livePnlUSD: parseFloat(pnlUSD.toFixed(2)),
      };
    });

    return {
      totalDeposited: parseFloat(totalDeposited.toFixed(2)),
      effectiveBalance: parseFloat(effectiveBalance.toFixed(2)),
      freeBalance: parseFloat(freeBalance.toFixed(2)),
      allocatedUSD: parseFloat(allocatedUSD.toFixed(2)),
      realizedPnL: parseFloat(realizedPnL.toFixed(2)),
      unrealizedPnL: parseFloat(unrealizedPnL.toFixed(2)),
      totalEquity: parseFloat((effectiveBalance + unrealizedPnL).toFixed(2)),
      totalReturn: totalDeposited > 0
        ? parseFloat(((effectiveBalance + unrealizedPnL - totalDeposited) / totalDeposited * 100).toFixed(2))
        : 0,
      openCount: open.length,
      closedCount: closed.length,
      wins,
      losses,
      winRate: closed.length > 0 ? parseFloat((wins / closed.length * 100).toFixed(1)) : null,
      openTrades: openFormatted,
      recentTrades: closed.slice(0, 15).map(t => this._fmt(t)),
    };
  }

  // ── Open a manual trade ────────────────────────────────────────────────────
  async openTrade(symbol = 'ETHUSDT', { direction, entryPrice, sizeUSD, stopLoss, takeProfit1, takeProfit2 }) {
    const dir   = direction?.toUpperCase();
    const price = parseFloat(entryPrice);
    const size  = parseFloat(sizeUSD);

    if (!['BUY', 'SELL'].includes(dir)) throw new Error('Direction must be BUY or SELL');
    if (!price || price <= 0)           throw new Error('Invalid entry price');
    if (!size  || size  <= 0)           throw new Error('Invalid size');

    const portfolio = await this.getPortfolio(symbol);
    if (portfolio.totalDeposited === 0) throw new Error('Please deposit funds first');
    if (size > portfolio.freeBalance)   throw new Error(`Insufficient free balance ($${portfolio.freeBalance.toFixed(2)} available)`);

    const sl  = stopLoss    ? parseFloat(stopLoss)    : null;
    const tp1 = takeProfit1 ? parseFloat(takeProfit1) : null;
    const tp2 = takeProfit2 ? parseFloat(takeProfit2) : null;

    const sizeUnits = size / price;

    const trade = await PaperTrade.create({
      symbol,
      direction: dir,
      entryPrice: parseFloat(price.toFixed(8)),
      sizeUSD: parseFloat(size.toFixed(2)),
      sizeUnits: parseFloat(sizeUnits.toFixed(8)),
      stopLoss: sl  ? parseFloat(sl.toFixed(8))  : null,
      takeProfit1: tp1 ? parseFloat(tp1.toFixed(8)) : null,
      takeProfit2: tp2 ? parseFloat(tp2.toFixed(8)) : null,
      autoExecuted: false,
    });

    logger.info(`[Paper] Manual ${dir} @ $${price.toFixed(2)} | size $${size.toFixed(2)} | SL ${sl ?? '—'} | TP ${tp1 ?? '—'}`);
    return this._fmt(trade);
  }

  // ── Monitor open trades — auto-close on SL or TP hit ─────────────────────
  async manageOpenTrades(symbol, currentPrice) {
    const open = await PaperTrade.findAll({ where: { symbol, status: 'open' } });
    const closed = [];
    for (const trade of open) {
      const price = parseFloat(currentPrice);
      const sl  = trade.stopLoss   ? parseFloat(trade.stopLoss)   : null;
      const tp1 = trade.takeProfit1 ? parseFloat(trade.takeProfit1) : null;
      const isBuy = trade.direction === 'BUY';

      let reason = null;
      if (sl  && isBuy  && price <= sl)  reason = 'SL';
      if (sl  && !isBuy && price >= sl)  reason = 'SL';
      if (tp1 && isBuy  && price >= tp1) reason = 'TP';
      if (tp1 && !isBuy && price <= tp1) reason = 'TP';

      if (reason) {
        const result = await this.closeTrade(trade.id, price, reason);
        if (result) closed.push(result);
      }
    }
    return closed;
  }

  // ── Close a specific trade ─────────────────────────────────────────────────
  async closeTrade(tradeId, exitPrice, reason = 'Manual') {
    const trade = await PaperTrade.findByPk(tradeId);
    if (!trade || trade.status !== 'open') return null;

    const entry   = parseFloat(trade.entryPrice);
    const exit    = parseFloat(exitPrice);
    const isBuy   = trade.direction === 'BUY';
    const sizeUSD = parseFloat(trade.sizeUSD);

    const pnlPct = isBuy
      ? ((exit - entry) / entry) * 100
      : ((entry - exit) / entry) * 100;
    const pnlUSD = sizeUSD * (pnlPct / 100);

    await trade.update({
      status: pnlPct < 0 ? 'stopped' : 'closed',
      exitPrice: parseFloat(exit.toFixed(8)),
      pnlPercent: parseFloat(pnlPct.toFixed(4)),
      pnlUSD: parseFloat(pnlUSD.toFixed(2)),
      closedReason: reason,
      closedAt: new Date(),
    });

    logger.info(`[Paper] Closed ${trade.direction} (${reason}): ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% / $${pnlUSD.toFixed(2)}`);
    return this._fmt(await trade.reload());
  }

  // ── Reset account ──────────────────────────────────────────────────────────
  async resetAccount(symbol = 'ETHUSDT') {
    await PaperTrade.destroy({ where: { symbol } });
    const account = await this._getAccount(symbol);
    await account.update({ totalDeposited: 0 });
    logger.info('[Paper] Account fully reset');
    return this.getPortfolio(symbol);
  }

  // ── Format trade for API response ─────────────────────────────────────────
  _fmt(t) {
    return {
      id:           t.id,
      direction:    t.direction,
      entryPrice:   parseFloat(t.entryPrice),
      sizeUSD:      parseFloat(t.sizeUSD),
      sizeUnits:    parseFloat(t.sizeUnits),
      stopLoss:     t.stopLoss    ? parseFloat(t.stopLoss)    : null,
      takeProfit1:  t.takeProfit1 ? parseFloat(t.takeProfit1) : null,
      takeProfit2:  t.takeProfit2 ? parseFloat(t.takeProfit2) : null,
      status:       t.status,
      exitPrice:    t.exitPrice   ? parseFloat(t.exitPrice)   : null,
      pnlPercent:   t.pnlPercent  ? parseFloat(t.pnlPercent)  : null,
      pnlUSD:       t.pnlUSD      ? parseFloat(t.pnlUSD)      : null,
      closedReason: t.closedReason || null,
      openedAt:     t.createdAt,
      closedAt:     t.closedAt || null,
    };
  }
}

module.exports = new PaperTradingService();
