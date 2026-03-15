const logger = require('../utils/logger');

class MarketStructureService {

  findSwingHighs(candles, lookback = 5) {
    const highs = candles.map(c => parseFloat(c.high));
    const swings = [];
    for (let i = lookback; i < highs.length - lookback; i++) {
      let isSwing = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && highs[j] >= highs[i]) { isSwing = false; break; }
      }
      if (isSwing) swings.push({ index: i, price: highs[i], timestamp: candles[i].timestamp });
    }
    return swings;
  }

  findSwingLows(candles, lookback = 5) {
    const lows = candles.map(c => parseFloat(c.low));
    const swings = [];
    for (let i = lookback; i < lows.length - lookback; i++) {
      let isSwing = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && lows[j] <= lows[i]) { isSwing = false; break; }
      }
      if (isSwing) swings.push({ index: i, price: lows[i], timestamp: candles[i].timestamp });
    }
    return swings;
  }

  /**
   * Analyze market structure
   * Returns: trend direction, BOS, CHoCH, last swing high/low
   */
  analyzeStructure(candles) {
    try {
      if (!candles || candles.length < 30) {
        return { trend: 'unknown', bos: false, choch: false, summary: 'Insufficient data' };
      }

      const last60 = candles.slice(-60);
      const swingHighs = this.findSwingHighs(last60, 4);
      const swingLows = this.findSwingLows(last60, 4);

      if (swingHighs.length < 2 || swingLows.length < 2) {
        return { trend: 'ranging', bos: false, choch: false, summary: 'Ranging market - no clear structure' };
      }

      // Last two swing highs and lows
      const sh1 = swingHighs[swingHighs.length - 2];
      const sh2 = swingHighs[swingHighs.length - 1];
      const sl1 = swingLows[swingLows.length - 2];
      const sl2 = swingLows[swingLows.length - 1];

      const makingHH = sh2.price > sh1.price; // Higher High
      const makingHL = sl2.price > sl1.price; // Higher Low
      const makingLH = sh2.price < sh1.price; // Lower High
      const makingLL = sl2.price < sl1.price; // Lower Low

      let trend = 'ranging';
      let bos = false;
      let choch = false;

      if (makingHH && makingHL) {
        trend = 'uptrend';
      } else if (makingLH && makingLL) {
        trend = 'downtrend';
      } else if (makingHH && makingLL) {
        trend = 'ranging'; // Expansion
      } else {
        trend = 'ranging';
      }

      // Break of Structure: in uptrend, price breaks below last swing low
      const currentClose = parseFloat(candles[candles.length - 1].close);
      if (trend === 'uptrend' && currentClose < sl2.price) {
        bos = true;
        choch = true; // Potential trend change
      }
      if (trend === 'downtrend' && currentClose > sh2.price) {
        bos = true;
        choch = true;
      }

      // Order blocks: last bearish candle before bullish impulse (simplified)
      const lastSwingHigh = sh2;
      const lastSwingLow = sl2;

      let summary = '';
      if (choch) {
        summary = `CHoCH detected - possible trend reversal from ${trend}`;
      } else {
        summary = `Market in ${trend}: ${makingHH ? 'HH' : 'LH'} + ${makingHL ? 'HL' : 'LL'}`;
      }

      return {
        trend,
        bos,
        choch,
        makingHH,
        makingHL,
        makingLH,
        makingLL,
        lastSwingHigh: lastSwingHigh ? parseFloat(lastSwingHigh.price.toFixed(2)) : null,
        lastSwingLow: lastSwingLow ? parseFloat(lastSwingLow.price.toFixed(2)) : null,
        swingHighCount: swingHighs.length,
        swingLowCount: swingLows.length,
        summary
      };
    } catch (err) {
      logger.error(`Market structure analysis error: ${err.message}`);
      return { trend: 'unknown', bos: false, choch: false, summary: 'Analysis error' };
    }
  }

  // Score market structure alignment with proposed trade
  scoreStructure(structure, proposedDirection) {
    if (!structure || structure.trend === 'unknown') return { boost: 0, vetoed: false };

    // VETO: CHoCH detected - market might reverse, don't trade current direction
    if (structure.choch) {
      return { boost: 0, vetoed: true, reason: `CHoCH detected - ${structure.summary}` };
    }

    let boost = 0;

    if (proposedDirection === 'bullish') {
      if (structure.trend === 'uptrend') boost += 2; // Trading with the trend
      if (structure.trend === 'downtrend') boost -= 2; // Counter-trend = high risk
      if (structure.makingHH && structure.makingHL) boost += 1; // Perfect structure
    }

    if (proposedDirection === 'bearish') {
      if (structure.trend === 'downtrend') boost += 2;
      if (structure.trend === 'uptrend') boost -= 2;
      if (structure.makingLH && structure.makingLL) boost += 1;
    }

    return { boost, vetoed: false };
  }
}

module.exports = new MarketStructureService();
