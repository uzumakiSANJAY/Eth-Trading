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

    // Bearish divergence: price makes higher high but RSI makes lower high
    if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
      const ph1 = priceHighs[priceHighs.length - 2];
      const ph2 = priceHighs[priceHighs.length - 1];
      const rh1 = rsiHighs.find(p => Math.abs(p.index - ph1.index) <= 5);
      const rh2 = rsiHighs.find(p => Math.abs(p.index - ph2.index) <= 5);
      if (rh1 && rh2 && ph2.value > ph1.value && rh2.value < rh1.value) {
        bearishDiv = true;
        // Strength = price divergence % only (RSI pts ≠ price %, can't be summed)
        bearishStrength = parseFloat(((ph2.value - ph1.value) / ph1.value * 100).toFixed(2));
      }
    }

    // Bullish divergence: price makes lower low but RSI makes higher low
    if (priceLows.length >= 2 && rsiLows.length >= 2) {
      const pl1 = priceLows[priceLows.length - 2];
      const pl2 = priceLows[priceLows.length - 1];
      const rl1 = rsiLows.find(p => Math.abs(p.index - pl1.index) <= 5);
      const rl2 = rsiLows.find(p => Math.abs(p.index - pl2.index) <= 5);
      if (rl1 && rl2 && pl2.value < pl1.value && rl2.value > rl1.value) {
        bullishDiv = true;
        // Strength = price divergence % only
        bullishStrength = parseFloat(((pl1.value - pl2.value) / pl1.value * 100).toFixed(2));
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
   * Main method: analyze divergences using proper pivot-based detection.
   * Requires historicalIndicators = { rsi: number[], macd: number[] } from DB.
   * Falls back to no-divergence if insufficient history is provided.
   */
  analyzeDivergences(ohlcvData, indicators, historicalIndicators = null) {
    try {
      const closes = ohlcvData.map(d => parseFloat(d.close));

      let rsiDiv  = { bearish: false, bullish: false, signal: 'none', bearishStrength: 0, bullishStrength: 0 };
      let macdDiv = { bearish: false, bullish: false, signal: 'none' };

      if (historicalIndicators && historicalIndicators.rsi.length >= 10) {
        // Use real pivot-based divergence detection
        rsiDiv  = this.detectRSIDivergence(closes, historicalIndicators.rsi);
        macdDiv = this.detectMACDDivergence(closes, historicalIndicators.macd);
      } else {
        // Not enough history — log and skip rather than use wrong approximation
        logger.debug('Divergence: insufficient indicator history, skipping detection');
      }

      const combined = {
        rsi: rsiDiv,
        macd: macdDiv,
        hasBullishDivergence: rsiDiv.bullish || macdDiv.bullish,
        hasBearishDivergence: rsiDiv.bearish || macdDiv.bearish,
        strongSignal: (rsiDiv.bullish && macdDiv.bullish) || (rsiDiv.bearish && macdDiv.bearish),
        summary: (rsiDiv.bullish || macdDiv.bullish) ? 'Bullish divergence - potential reversal up'
                : (rsiDiv.bearish || macdDiv.bearish) ? 'Bearish divergence - potential reversal down'
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
