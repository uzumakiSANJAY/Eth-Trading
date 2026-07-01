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
    const atrPct = (atr && !isNaN(atr) && avgPrice > 0) ? (atr / avgPrice * 100) : 1.0;
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
   * Enhanced risk management with partial TP levels.
   * SL/TP width adapts to volatilityRegime so stops are not hit by normal noise:
   *   LOW     → 1.2× ATR stop,  1.5/3/5 TP
   *   NORMAL  → 1.5× ATR stop,  1.5/3/5 TP
   *   HIGH    → 2.0× ATR stop,  2.0/4/6 TP  (wider stops survive volatility spikes)
   *   EXTREME → 2.5× ATR stop,  2.5/5/8 TP  (very wide; high RR compensates)
   */
  calculateEnhancedRisk(currentPrice, signalType, atr, _positionSize = null, volatilityRegime = 'NORMAL') {
    const atrMultiplierMap = { LOW: 1.2, NORMAL: 1.5, HIGH: 2.0, EXTREME: 2.5 };
    const tpMultiplierMap  = {
      LOW:     [1.5, 3.0, 5.0],
      NORMAL:  [1.5, 3.0, 5.0],
      HIGH:    [2.0, 4.0, 6.0],
      EXTREME: [2.5, 5.0, 8.0],
    };

    const atrMultiplier = atrMultiplierMap[volatilityRegime] || 1.5;
    const [tp1M, tp2M, tp3M] = tpMultiplierMap[volatilityRegime] || tpMultiplierMap.NORMAL;

    // Guard: ATR of 0 or NaN → fall back to 1% of price as minimum stop distance.
    const safeAtr = (atr && !isNaN(atr) && atr > 0) ? atr : currentPrice * 0.01;
    const stopLossDistance = safeAtr * atrMultiplier;

    let stopLoss, takeProfit1, takeProfit2, takeProfit3, entryZoneMin, entryZoneMax;

    if (signalType === 'BUY') {
      stopLoss    = currentPrice - stopLossDistance;
      takeProfit1 = currentPrice + stopLossDistance * tp1M;
      takeProfit2 = currentPrice + stopLossDistance * tp2M;
      takeProfit3 = currentPrice + stopLossDistance * tp3M;
      entryZoneMin = currentPrice * 0.997;
      entryZoneMax = currentPrice * 1.003;
    } else {
      stopLoss    = currentPrice + stopLossDistance;
      takeProfit1 = currentPrice - stopLossDistance * tp1M;
      takeProfit2 = currentPrice - stopLossDistance * tp2M;
      takeProfit3 = currentPrice - stopLossDistance * tp3M;
      entryZoneMin = currentPrice * 0.997;
      entryZoneMax = currentPrice * 1.003;
    }

    const riskRewardRatio = Math.abs((takeProfit2 - currentPrice) / (stopLoss - currentPrice));

    const breakevenStop = signalType === 'BUY'
      ? currentPrice + (stopLossDistance * 0.3)
      : currentPrice - (stopLossDistance * 0.3);

    const tpLabels = {
      LOW:     ['Close 50% at TP1 (1.5R), move stop to breakeven', 'Close 30% at TP2 (3R), trail remaining', 'Exit final 20% at TP3 (5R)'],
      NORMAL:  ['Close 50% at TP1 (1.5R), move stop to breakeven', 'Close 30% at TP2 (3R), trail remaining', 'Exit final 20% at TP3 (5R)'],
      HIGH:    ['Close 50% at TP1 (2R) — volatile market, take profit early', 'Close 30% at TP2 (4R), trail remaining', 'Exit final 20% at TP3 (6R) if momentum holds'],
      EXTREME: ['Close 60% at TP1 (2.5R) — extreme market, secure gains fast', 'Close 25% at TP2 (5R) with tight trail', 'Exit final 15% at TP3 (8R) — maximum RR target'],
    };
    const [l1, l2, l3] = tpLabels[volatilityRegime] || tpLabels.NORMAL;

    return {
      stopLoss:        parseFloat(stopLoss.toFixed(2)),
      takeProfit1:     parseFloat(takeProfit1.toFixed(2)),
      takeProfit2:     parseFloat(takeProfit2.toFixed(2)),
      takeProfit3:     parseFloat(takeProfit3.toFixed(2)),
      entryZoneMin:    parseFloat(entryZoneMin.toFixed(2)),
      entryZoneMax:    parseFloat(entryZoneMax.toFixed(2)),
      riskRewardRatio: parseFloat(riskRewardRatio.toFixed(2)),
      breakevenStop:   parseFloat(breakevenStop.toFixed(2)),
      volatilityRegime,
      atrMultiplierUsed: atrMultiplier,
      tradeManagement: { atTP1: l1, atTP2: l2, atTP3: l3 },
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
