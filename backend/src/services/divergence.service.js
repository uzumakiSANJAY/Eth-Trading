const logger = require('../utils/logger');

class DivergenceService {

  // Find local pivot highs in an array (look_left and look_right bars)
  findPivotHighs(values, lookback = 5) {
    const pivots = [];
    for (let i = lookback; i < values.length - lookback; i++) {
      let isPivot = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && values[j] >= values[i]) { isPivot = false; break; }
      }
      if (isPivot) pivots.push({ index: i, value: values[i] });
    }
    return pivots;
  }

  findPivotLows(values, lookback = 5) {
    const pivots = [];
    for (let i = lookback; i < values.length - lookback; i++) {
      let isPivot = true;
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && values[j] <= values[i]) { isPivot = false; break; }
      }
      if (isPivot) pivots.push({ index: i, value: values[i] });
    }
    return pivots;
  }

  /**
   * Detect RSI divergence
   * Bearish: price makes HH, RSI makes LH → bearish divergence (reversal down)
   * Bullish: price makes LL, RSI makes HL → bullish divergence (reversal up)
   */
  detectRSIDivergence(closes, rsiValues) {
    // Need aligned arrays - use last 50 bars
    const len = Math.min(closes.length, rsiValues.length, 50);
    const c = closes.slice(-len);
    const r = rsiValues.slice(-len);

    const priceHighs = this.findPivotHighs(c, 4);
    const priceLows = this.findPivotLows(c, 4);
    const rsiHighs = this.findPivotHighs(r, 4);
    const rsiLows = this.findPivotLows(r, 4);

    let bearishDiv = false;
    let bullishDiv = false;
    let bearishStrength = 0;
    let bullishStrength = 0;

    // Bearish divergence: last two price highs where price is higher but RSI is lower
    if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
      const ph1 = priceHighs[priceHighs.length - 2];
      const ph2 = priceHighs[priceHighs.length - 1];
      // Find nearest RSI highs
      const rh1 = rsiHighs.find(p => Math.abs(p.index - ph1.index) <= 5);
      const rh2 = rsiHighs.find(p => Math.abs(p.index - ph2.index) <= 5);
      if (rh1 && rh2 && ph2.value > ph1.value && rh2.value < rh1.value) {
        bearishDiv = true;
        bearishStrength = ((ph2.value - ph1.value) / ph1.value * 100) + (rh1.value - rh2.value);
      }
    }

    // Bullish divergence: last two price lows where price is lower but RSI is higher
    if (priceLows.length >= 2 && rsiLows.length >= 2) {
      const pl1 = priceLows[priceLows.length - 2];
      const pl2 = priceLows[priceLows.length - 1];
      const rl1 = rsiLows.find(p => Math.abs(p.index - pl1.index) <= 5);
      const rl2 = rsiLows.find(p => Math.abs(p.index - pl2.index) <= 5);
      if (rl1 && rl2 && pl2.value < pl1.value && rl2.value > rl1.value) {
        bullishDiv = true;
        bullishStrength = ((pl1.value - pl2.value) / pl1.value * 100) + (rl2.value - rl1.value);
      }
    }

    return {
      bearish: bearishDiv,
      bullish: bullishDiv,
      bearishStrength: parseFloat(bearishStrength.toFixed(2)),
      bullishStrength: parseFloat(bullishStrength.toFixed(2)),
      signal: bearishDiv ? 'bearish_divergence' : bullishDiv ? 'bullish_divergence' : 'none'
    };
  }

  /**
   * Detect MACD divergence
   */
  detectMACDDivergence(closes, macdHistogram) {
    const len = Math.min(closes.length, macdHistogram.length, 50);
    const c = closes.slice(-len);
    const m = macdHistogram.slice(-len);

    const priceHighs = this.findPivotHighs(c, 4);
    const priceLows = this.findPivotLows(c, 4);
    const macdHighs = this.findPivotHighs(m, 4);
    const macdLows = this.findPivotLows(m, 4);

    let bearishDiv = false;
    let bullishDiv = false;

    if (priceHighs.length >= 2 && macdHighs.length >= 2) {
      const ph1 = priceHighs[priceHighs.length - 2];
      const ph2 = priceHighs[priceHighs.length - 1];
      const mh1 = macdHighs.find(p => Math.abs(p.index - ph1.index) <= 5);
      const mh2 = macdHighs.find(p => Math.abs(p.index - ph2.index) <= 5);
      if (mh1 && mh2 && ph2.value > ph1.value && mh2.value < mh1.value) {
        bearishDiv = true;
      }
    }

    if (priceLows.length >= 2 && macdLows.length >= 2) {
      const pl1 = priceLows[priceLows.length - 2];
      const pl2 = priceLows[priceLows.length - 1];
      const ml1 = macdLows.find(p => Math.abs(p.index - pl1.index) <= 5);
      const ml2 = macdLows.find(p => Math.abs(p.index - pl2.index) <= 5);
      if (ml1 && ml2 && pl2.value < pl1.value && ml2.value > ml1.value) {
        bullishDiv = true;
      }
    }

    return {
      bearish: bearishDiv,
      bullish: bullishDiv,
      signal: bearishDiv ? 'bearish_divergence' : bullishDiv ? 'bullish_divergence' : 'none'
    };
  }

  /**
   * Main method: analyze divergences from OHLCV + indicator data
   */
  analyzeDivergences(ohlcvData, indicators) {
    try {
      const closes = ohlcvData.map(d => parseFloat(d.close));
      // We need RSI and MACD values - extract from indicator history
      // For now use what we have in the latest indicator + estimate from closes pattern
      const rsiDiv = { bearish: false, bullish: false, signal: 'none', bearishStrength: 0, bullishStrength: 0 };
      const macdDiv = { bearish: false, bullish: false, signal: 'none' };

      // If we have enough close data, compute simplified divergence check
      // using last 20 bars of closes as proxy (real impl needs historical indicator values)
      if (closes.length >= 20) {
        // Check last 10 bars: is price making higher highs while momentum is slowing?
        const last10 = closes.slice(-10);
        const first5avg = (last10[0] + last10[1] + last10[2] + last10[3] + last10[4]) / 5;
        const last5avg = (last10[5] + last10[6] + last10[7] + last10[8] + last10[9]) / 5;
        const priceSlope = (last5avg - first5avg) / first5avg * 100;

        // Use current RSI as proxy
        if (indicators && indicators.rsi) {
          const rsi = parseFloat(indicators.rsi);
          // Bearish divergence signal: price rising but RSI overbought and price near recent high
          if (priceSlope > 1 && rsi > 65 && rsi < 80) {
            rsiDiv.bearish = true;
            rsiDiv.signal = 'bearish_divergence';
            rsiDiv.bearishStrength = parseFloat((priceSlope * (rsi / 70)).toFixed(2));
          }
          // Bullish divergence signal: price falling but RSI oversold
          if (priceSlope < -1 && rsi < 35 && rsi > 20) {
            rsiDiv.bullish = true;
            rsiDiv.signal = 'bullish_divergence';
            rsiDiv.bullishStrength = parseFloat((Math.abs(priceSlope) * (35 / rsi)).toFixed(2));
          }
        }
      }

      const combined = {
        rsi: rsiDiv,
        macd: macdDiv,
        hasBullishDivergence: rsiDiv.bullish || macdDiv.bullish,
        hasBearishDivergence: rsiDiv.bearish || macdDiv.bearish,
        strongSignal: (rsiDiv.bullish && macdDiv.bullish) || (rsiDiv.bearish && macdDiv.bearish),
        summary: rsiDiv.bullish ? 'Bullish divergence - potential reversal up'
                : rsiDiv.bearish ? 'Bearish divergence - potential reversal down'
                : 'No divergence detected'
      };

      logger.info(`Divergence analysis: ${combined.summary}`);
      return combined;
    } catch (err) {
      logger.error(`Divergence analysis error: ${err.message}`);
      return { hasBullishDivergence: false, hasBearishDivergence: false, strongSignal: false, summary: 'Error' };
    }
  }

  // Convert divergence to score boost
  scoreDiv(divergence, proposedDirection) {
    if (!divergence) return { boost: 0, direction: 'neutral' };
    if (divergence.hasBullishDivergence && proposedDirection === 'bullish') {
      return { boost: divergence.strongSignal ? 3 : 2, direction: 'bullish' };
    }
    if (divergence.hasBearishDivergence && proposedDirection === 'bearish') {
      return { boost: divergence.strongSignal ? 3 : 2, direction: 'bearish' };
    }
    // Counter-signal: divergence opposes proposed direction - reduce score
    if (divergence.hasBearishDivergence && proposedDirection === 'bullish') {
      return { boost: -2, direction: 'warning' };
    }
    if (divergence.hasBullishDivergence && proposedDirection === 'bearish') {
      return { boost: -2, direction: 'warning' };
    }
    return { boost: 0, direction: 'neutral' };
  }
}

module.exports = new DivergenceService();
