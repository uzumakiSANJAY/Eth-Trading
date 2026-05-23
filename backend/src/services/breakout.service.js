const logger = require('../utils/logger');

class BreakoutService {
  /**
   * Detect S/R level breakouts across a series of candles.
   * Breakout = price closes above resistance or below support.
   * Volume confirmation: candle volume > avgVolume * 1.3.
   */
  detectSRBreakouts(candles, srLevels, avgVolume) {
    const breakouts = [];
    if (!srLevels || !candles.length || candles.length < 2) return breakouts;

    const allLevels = [
      ...(srLevels.resistances || []).map(r => ({ level: r, type: 'resistance' })),
      ...(srLevels.supports || []).map(s => ({ level: s, type: 'support' })),
    ];

    for (let i = 1; i < candles.length; i++) {
      const candle = candles[i];
      const prevCandle = candles[i - 1];
      const close = parseFloat(candle.close);
      const prevClose = parseFloat(prevCandle.close);
      const volume = parseFloat(candle.volume);
      const volumeConfirmed = avgVolume > 0 && volume > avgVolume * 1.3;

      for (const { level, type } of allLevels) {
        // Resistance breakout: prev close below → current close above
        if (type === 'resistance' && prevClose < level && close > level) {
          breakouts.push({
            level: parseFloat(level.toFixed(2)),
            direction: 'bullish',
            type: 'resistance_break',
            breakoutPrice: parseFloat(close.toFixed(2)),
            timestamp: candle.timestamp,
            volumeConfirmed,
            volume: parseFloat(volume.toFixed(2)),
            avgVolume: parseFloat((avgVolume || 0).toFixed(2)),
            strengthPct: parseFloat(((close - level) / level * 100).toFixed(2)),
          });
        }

        // Support breakdown: prev close above → current close below
        if (type === 'support' && prevClose > level && close < level) {
          breakouts.push({
            level: parseFloat(level.toFixed(2)),
            direction: 'bearish',
            type: 'support_break',
            breakoutPrice: parseFloat(close.toFixed(2)),
            timestamp: candle.timestamp,
            volumeConfirmed,
            volume: parseFloat(volume.toFixed(2)),
            avgVolume: parseFloat((avgVolume || 0).toFixed(2)),
            strengthPct: parseFloat(((level - close) / level * 100).toFixed(2)),
          });
        }
      }
    }

    return breakouts;
  }

  /**
   * Detect false breakouts (bull trap / bear trap).
   * A false breakout = price breaks a level but closes back inside within 2 candles.
   */
  detectFalseBreakouts(breakouts, candles) {
    const falseBreakouts = [];

    for (const bo of breakouts) {
      const boIdx = candles.findIndex(c => c.timestamp === bo.timestamp);
      if (boIdx === -1 || boIdx >= candles.length - 1) continue;

      for (let j = boIdx + 1; j <= Math.min(boIdx + 2, candles.length - 1); j++) {
        const close = parseFloat(candles[j].close);
        if (bo.direction === 'bullish' && close < bo.level) {
          falseBreakouts.push({ ...bo, trap: 'bull_trap', reverseTimestamp: candles[j].timestamp });
          break;
        }
        if (bo.direction === 'bearish' && close > bo.level) {
          falseBreakouts.push({ ...bo, trap: 'bear_trap', reverseTimestamp: candles[j].timestamp });
          break;
        }
      }
    }

    return falseBreakouts;
  }

  /**
   * Detect BB squeeze state and whether price has broken out.
   * Squeeze = bbWidth < 2.5%. Breakout = price closes beyond band after squeeze.
   */
  detectBBBreakout(indicators) {
    if (!indicators || indicators.bbWidth === null || indicators.bbWidth === undefined) return null;

    const bbWidth = parseFloat(indicators.bbWidth);
    const upper = parseFloat(indicators.bollingerUpper || 0);
    const lower = parseFloat(indicators.bollingerLower || 0);
    // Use the most recent close price (ema9 is close enough as a proxy)
    const price = parseFloat(indicators.ema9 || 0);

    const inSqueeze = bbWidth < 2.5;
    const priceAboveUpper = upper > 0 && price > upper;
    const priceBelowLower = lower > 0 && price < lower;

    return {
      inSqueeze,
      bbWidth: parseFloat(bbWidth.toFixed(2)),
      breakoutDetected: priceAboveUpper || priceBelowLower,
      direction: priceAboveUpper ? 'bullish' : priceBelowLower ? 'bearish' : null,
      description: inSqueeze
        ? `BB Squeeze (${bbWidth.toFixed(2)}%) — volatility compressed, breakout imminent`
        : `BB Normal width (${bbWidth.toFixed(2)}%)`,
    };
  }

  /**
   * Detect EMA momentum crossovers as breakout signals.
   * EMA9 crossing above/below EMA21 = short-term momentum shift.
   */
  detectEMACrossover(indicators) {
    if (!indicators || !indicators.ema9 || !indicators.ema21 || !indicators.ema50) return null;

    const ema9 = parseFloat(indicators.ema9);
    const ema21 = parseFloat(indicators.ema21);
    const ema50 = parseFloat(indicators.ema50);

    const bullishCross = ema9 > ema21; // fast above slow
    const bearishCross = ema9 < ema21;
    const alignedBull = ema9 > ema21 && ema21 > ema50;
    const alignedBear = ema9 < ema21 && ema21 < ema50;

    const gap = Math.abs(ema9 - ema21);
    const gapPct = parseFloat((gap / ema21 * 100).toFixed(3));

    return {
      bullishCross,
      bearishCross,
      alignedBull,
      alignedBear,
      gapPct,
      direction: alignedBull ? 'bullish' : alignedBear ? 'bearish' : 'mixed',
      description: alignedBull
        ? `Bullish EMA stack: EMA9 > EMA21 > EMA50 (gap ${gapPct}%)`
        : alignedBear
          ? `Bearish EMA stack: EMA9 < EMA21 < EMA50 (gap ${gapPct}%)`
          : `Mixed EMA alignment (gap ${gapPct}%)`,
    };
  }

  /**
   * Detect volume spikes — sudden volume >2x avg is often a catalyst event.
   */
  detectVolumeSpikes(candles, avgVolume) {
    if (!avgVolume || candles.length === 0) return [];
    return candles
      .filter(c => parseFloat(c.volume) > avgVolume * 2)
      .map(c => ({
        timestamp: c.timestamp,
        volume: parseFloat(parseFloat(c.volume).toFixed(2)),
        avgVolume: parseFloat(avgVolume.toFixed(2)),
        ratio: parseFloat((parseFloat(c.volume) / avgVolume).toFixed(2)),
        direction: parseFloat(c.close) >= parseFloat(c.open) ? 'bullish' : 'bearish',
        priceChange: parseFloat(((parseFloat(c.close) - parseFloat(c.open)) / parseFloat(c.open) * 100).toFixed(2)),
      }));
  }

  /**
   * Main entry point: run all breakout checks and return a structured report.
   */
  analyzeBreakouts(candles, indicators, srLevels, avgVolume) {
    try {
      const srBreakouts = this.detectSRBreakouts(candles, srLevels, avgVolume);
      const falseBreakouts = this.detectFalseBreakouts(srBreakouts, candles);
      const falseTimestamps = new Set(falseBreakouts.map(f => f.timestamp));

      const confirmedBreakouts = srBreakouts.filter(b => !falseTimestamps.has(b.timestamp));
      const volumeConfirmedBreakouts = confirmedBreakouts.filter(b => b.volumeConfirmed);

      const bbBreakout = this.detectBBBreakout(indicators);
      const emaBreakout = this.detectEMACrossover(indicators);
      const volumeSpikes = this.detectVolumeSpikes(candles, avgVolume);

      const summaryParts = [];
      const bullishConfirmed = volumeConfirmedBreakouts.filter(b => b.direction === 'bullish').length;
      const bearishConfirmed = volumeConfirmedBreakouts.filter(b => b.direction === 'bearish').length;
      if (bullishConfirmed > 0) summaryParts.push(`${bullishConfirmed} bullish breakout${bullishConfirmed > 1 ? 's' : ''} (volume confirmed)`);
      if (bearishConfirmed > 0) summaryParts.push(`${bearishConfirmed} bearish breakdown${bearishConfirmed > 1 ? 's' : ''} (volume confirmed)`);
      if (falseBreakouts.length > 0) summaryParts.push(`${falseBreakouts.length} false breakout${falseBreakouts.length > 1 ? 's' : ''} (trap)`);
      if (volumeSpikes.length > 0) summaryParts.push(`${volumeSpikes.length} volume spike${volumeSpikes.length > 1 ? 's' : ''}`);
      if (bbBreakout?.inSqueeze) summaryParts.push(`BB squeeze — pending breakout direction`);

      return {
        srBreakouts: confirmedBreakouts,
        volumeConfirmedBreakouts,
        falseBreakouts,
        bbBreakout,
        emaBreakout,
        volumeSpikes,
        totalSRBreakouts: srBreakouts.length,
        confirmedCount: confirmedBreakouts.length,
        volumeConfirmedCount: volumeConfirmedBreakouts.length,
        falseCount: falseBreakouts.length,
        summary: summaryParts.length > 0 ? summaryParts.join(' | ') : 'No significant breakouts detected today',
      };
    } catch (err) {
      logger.error(`Breakout analysis error: ${err.message}`);
      return {
        srBreakouts: [], volumeConfirmedBreakouts: [], falseBreakouts: [],
        bbBreakout: null, emaBreakout: null, volumeSpikes: [],
        totalSRBreakouts: 0, confirmedCount: 0, volumeConfirmedCount: 0, falseCount: 0,
        summary: 'Breakout analysis unavailable',
      };
    }
  }
}

module.exports = new BreakoutService();
