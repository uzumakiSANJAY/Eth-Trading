const logger = require('../utils/logger');
const { setCache, getCache } = require('../database/config/redis');

class RiskManagerService {

  /**
   * Calculate dynamic position size based on account risk % and ATR volatility
   * @param {number} accountSize - total account in USD
   * @param {number} riskPercent - % of account to risk per trade (default 1.5%)
   * @param {number} entryPrice - entry price
   * @param {number} stopLossPrice - stop loss price
   * @param {number} atr - current ATR value
   * @returns position size details
   */
  calculatePositionSize(accountSize, riskPercent, entryPrice, stopLossPrice, atr) {
    const riskAmount = accountSize * (riskPercent / 100);
    const stopDistance = Math.abs(entryPrice - stopLossPrice);

    if (stopDistance === 0) {
      return { positionSize: 0, riskAmount, leverage: 1, warning: 'Zero stop distance' };
    }

    // Volatility adjustment: if ATR is high, reduce position size
    const avgPrice = entryPrice;
    const atrPct = atr / avgPrice * 100;
    let volatilityMultiplier = 1.0;
    if (atrPct > 3) volatilityMultiplier = 0.5;       // Very high volatility - halve size
    else if (atrPct > 2) volatilityMultiplier = 0.75;  // High volatility
    else if (atrPct < 0.5) volatilityMultiplier = 1.25; // Low volatility - can size up

    const adjustedRisk = riskAmount * volatilityMultiplier;
    const positionSizeUSD = adjustedRisk / (stopDistance / entryPrice);
    const positionSizeETH = positionSizeUSD / entryPrice;

    return {
      positionSizeUSD: parseFloat(positionSizeUSD.toFixed(2)),
      positionSizeETH: parseFloat(positionSizeETH.toFixed(4)),
      riskAmount: parseFloat(adjustedRisk.toFixed(2)),
      riskPercent: parseFloat((adjustedRisk / accountSize * 100).toFixed(2)),
      volatilityMultiplier,
      atrPct: parseFloat(atrPct.toFixed(2)),
      stopDistancePct: parseFloat((stopDistance / entryPrice * 100).toFixed(2))
    };
  }

  /**
   * Enhanced risk management with partial TP levels
   * 50% position closed at TP1, move stop to breakeven
   * 30% at TP2, 20% at TP3
   */
  calculateEnhancedRisk(currentPrice, signalType, atr, _positionSize = null) {
    const atrMultiplier = 1.5;
    const stopLossDistance = atr * atrMultiplier;

    let stopLoss, takeProfit1, takeProfit2, takeProfit3, entryZoneMin, entryZoneMax;

    if (signalType === 'BUY') {
      stopLoss = currentPrice - stopLossDistance;
      takeProfit1 = currentPrice + stopLossDistance * 1.5; // 1:1.5 RR (close 50%)
      takeProfit2 = currentPrice + stopLossDistance * 3;   // 1:3 RR (close 30%)
      takeProfit3 = currentPrice + stopLossDistance * 5;   // 1:5 RR (close 20%)
      entryZoneMin = currentPrice * 0.997;
      entryZoneMax = currentPrice * 1.003;
    } else {
      stopLoss = currentPrice + stopLossDistance;
      takeProfit1 = currentPrice - stopLossDistance * 1.5;
      takeProfit2 = currentPrice - stopLossDistance * 3;
      takeProfit3 = currentPrice - stopLossDistance * 5;
      entryZoneMin = currentPrice * 0.997;
      entryZoneMax = currentPrice * 1.003;
    }

    const riskRewardRatio = Math.abs((takeProfit2 - currentPrice) / (stopLoss - currentPrice));

    // Breakeven after TP1 - move stop here
    const breakevenStop = signalType === 'BUY'
      ? currentPrice + (stopLossDistance * 0.3)
      : currentPrice - (stopLossDistance * 0.3);

    return {
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit1: parseFloat(takeProfit1.toFixed(2)),
      takeProfit2: parseFloat(takeProfit2.toFixed(2)),
      takeProfit3: parseFloat(takeProfit3.toFixed(2)),
      entryZoneMin: parseFloat(entryZoneMin.toFixed(2)),
      entryZoneMax: parseFloat(entryZoneMax.toFixed(2)),
      riskRewardRatio: parseFloat(riskRewardRatio.toFixed(2)),
      breakevenStop: parseFloat(breakevenStop.toFixed(2)),
      tradeManagement: {
        atTP1: 'Close 50% of position, move stop to breakeven',
        atTP2: 'Close 30% of position, trailing stop on remaining',
        atTP3: 'Close final 20% - full position exit'
      }
    };
  }

  /**
   * Daily loss circuit breaker
   * Tracks daily P&L via Redis, blocks trading if max loss hit
   */
  async checkCircuitBreaker(symbol = 'ETHUSDT') {
    const today = new Date().toISOString().split('T')[0];
    const key = `risk:circuit:${symbol}:${today}`;
    const data = await getCache(key);

    if (!data) {
      // Initialize today's session
      const session = { losses: 0, wins: 0, totalPnlPct: 0, blocked: false, blockReason: null };
      await setCache(key, session, 86400); // 24 hours
      return { allowed: true, session };
    }

    if (data.blocked) {
      return {
        allowed: false,
        session: data,
        reason: data.blockReason || 'Circuit breaker active - daily loss limit reached'
      };
    }

    return { allowed: true, session: data };
  }

  async recordTradeResult(symbol, pnlPct, won) {
    const today = new Date().toISOString().split('T')[0];
    const key = `risk:circuit:${symbol}:${today}`;
    const data = await getCache(key) || { losses: 0, wins: 0, totalPnlPct: 0, blocked: false };

    data.wins += won ? 1 : 0;
    data.losses += won ? 0 : 1;
    data.totalPnlPct += pnlPct;

    // Circuit breaker rules:
    // 1. More than 3 losses today
    // 2. Total daily loss > 3%
    if (data.losses >= 3) {
      data.blocked = true;
      data.blockReason = `3 losses today (${data.losses} losses) - trading suspended for rest of day`;
    }
    if (data.totalPnlPct <= -3) {
      data.blocked = true;
      data.blockReason = `Daily loss limit reached: ${data.totalPnlPct.toFixed(2)}% - trading suspended`;
    }

    await setCache(key, data, 86400);
    logger.info(`Trade recorded: ${won ? 'WIN' : 'LOSS'} ${pnlPct}% | Daily: ${data.totalPnlPct.toFixed(2)}% | Losses: ${data.losses}`);
    return data;
  }

  async getDailyStats(symbol = 'ETHUSDT') {
    const today = new Date().toISOString().split('T')[0];
    const key = `risk:circuit:${symbol}:${today}`;
    const data = await getCache(key);
    return data || { losses: 0, wins: 0, totalPnlPct: 0, blocked: false };
  }

  /**
   * Volume Profile - Point of Control (POC)
   * The price level with the most trading volume = strong magnet
   */
  calculateVolumeProfile(ohlcvData, bins = 20) {
    try {
      if (!ohlcvData || ohlcvData.length < 10) return null;

      const highs = ohlcvData.map(d => parseFloat(d.high));
      const lows = ohlcvData.map(d => parseFloat(d.low));
      const volumes = ohlcvData.map(d => parseFloat(d.volume));

      const priceMin = Math.min(...lows);
      const priceMax = Math.max(...highs);
      const binSize = (priceMax - priceMin) / bins;

      // Build volume histogram
      const histogram = Array(bins).fill(0);
      for (let i = 0; i < ohlcvData.length; i++) {
        const typicalPrice = (parseFloat(ohlcvData[i].high) + parseFloat(ohlcvData[i].low) + parseFloat(ohlcvData[i].close)) / 3;
        const binIndex = Math.min(Math.floor((typicalPrice - priceMin) / binSize), bins - 1);
        histogram[binIndex] += volumes[i];
      }

      // Point of Control = bin with highest volume
      const maxVolBin = histogram.indexOf(Math.max(...histogram));
      const poc = priceMin + (maxVolBin + 0.5) * binSize;

      // Value Area High/Low (70% of volume)
      const totalVol = histogram.reduce((a, b) => a + b, 0);
      const targetVol = totalVol * 0.7;
      let accVol = histogram[maxVolBin];
      let vahBin = maxVolBin, valBin = maxVolBin;
      while (accVol < targetVol && (vahBin < bins - 1 || valBin > 0)) {
        const upVol = vahBin < bins - 1 ? histogram[vahBin + 1] : 0;
        const dnVol = valBin > 0 ? histogram[valBin - 1] : 0;
        if (upVol >= dnVol && vahBin < bins - 1) { vahBin++; accVol += upVol; }
        else if (valBin > 0) { valBin--; accVol += dnVol; }
        else break;
      }

      return {
        poc: parseFloat(poc.toFixed(2)),
        vah: parseFloat((priceMin + (vahBin + 1) * binSize).toFixed(2)),
        val: parseFloat((priceMin + valBin * binSize).toFixed(2)),
        priceRange: { min: parseFloat(priceMin.toFixed(2)), max: parseFloat(priceMax.toFixed(2)) }
      };
    } catch (err) {
      logger.error(`Volume profile error: ${err.message}`);
      return null;
    }
  }
}

module.exports = new RiskManagerService();
