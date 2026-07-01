const { BollingerBands } = require('technicalindicators');
const logger = require('../utils/logger');

class VolatilityService {

  /**
   * Classify current market volatility regime from ATR%.
   * ATR%  < 1.5% → LOW     (compressed, breakout coiling)
   * ATR%  1.5-3% → NORMAL  (standard conditions)
   * ATR%  3-5%   → HIGH    (trending volatile — widen stops)
   * ATR%  > 5%   → EXTREME (panic/euphoria — max caution)
   */
  classifyRegime(atr, currentPrice) {
    if (!atr || !currentPrice || currentPrice === 0) return 'NORMAL';
    const atrPct = (atr / currentPrice) * 100;
    if (atrPct > 5)   return 'EXTREME';
    if (atrPct > 3)   return 'HIGH';
    if (atrPct < 1.5) return 'LOW';
    return 'NORMAL';
  }

  /**
   * Detect Bollinger Band squeeze — current width at or near its 20-period low.
   * A squeeze means volatility is compressing; a directional breakout is imminent.
   * Returns { isSqueezing, intensity, currentWidth, avgWidth }
   */
  detectBBSqueeze(ohlcvData) {
    try {
      if (!ohlcvData || ohlcvData.length < 30) return { isSqueezing: false };

      const closes = ohlcvData.map(d => parseFloat(d.close));
      const bbSeries = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });

      if (bbSeries.length < 15) return { isSqueezing: false };

      const widths = bbSeries.map(bb => ((bb.upper - bb.lower) / bb.middle) * 100);

      const currentWidth = widths[widths.length - 1];
      const lookback     = widths.slice(-20);
      const minRecent    = Math.min(...lookback);
      const avgRecent    = lookback.reduce((a, b) => a + b, 0) / lookback.length;

      // Squeeze: current width within 15% of the 20-period low
      const isSqueezing = currentWidth <= minRecent * 1.15;
      const intensity = isSqueezing
        ? (currentWidth < avgRecent * 0.5 ? 'strong' : 'mild')
        : 'none';

      return {
        isSqueezing,
        intensity,
        currentWidth: parseFloat(currentWidth.toFixed(3)),
        avgWidth:     parseFloat(avgRecent.toFixed(3)),
      };
    } catch (err) {
      logger.warn(`BB squeeze detection failed: ${err.message}`);
      return { isSqueezing: false };
    }
  }

  /**
   * Returns per-regime trading adaptations used by signal and risk services.
   *
   * atrMultiplier    — SL/TP distance multiplier (higher = wider stops)
   * tpMultipliers    — [TP1, TP2, TP3] as multiples of stop distance
   * minConfidence    — minimum score % to emit BUY/SELL (vs HOLD)
   * positionMultiplier — scale account risk up/down
   * bypassAdxFilter  — skip ADX ranging check (needed during squeezes)
   */
  getAdaptations(regime, squeeze = {}) {
    const base = {
      LOW:     { atrMultiplier: 1.2, minConfidence: 63, positionMultiplier: 1.2, tpMultipliers: [1.5, 3.0, 5.0] },
      NORMAL:  { atrMultiplier: 1.5, minConfidence: 65, positionMultiplier: 1.0, tpMultipliers: [1.5, 3.0, 5.0] },
      HIGH:    { atrMultiplier: 2.0, minConfidence: 70, positionMultiplier: 0.7, tpMultipliers: [2.0, 4.0, 6.0] },
      EXTREME: { atrMultiplier: 2.5, minConfidence: 75, positionMultiplier: 0.5, tpMultipliers: [2.5, 5.0, 8.0] },
    };

    const adaptations = { ...(base[regime] || base.NORMAL), bypassAdxFilter: false };

    // During squeeze: lower threshold slightly and bypass ADX filter.
    // ADX is structurally low in a squeeze — that's normal, not a disqualifier.
    if (squeeze?.isSqueezing) {
      adaptations.minConfidence  = Math.max(60, adaptations.minConfidence - 5);
      adaptations.bypassAdxFilter = true;
    }

    return adaptations;
  }

  describe(regime, squeeze = {}) {
    const labels = {
      LOW:     'Low Volatility — coiling, breakout imminent',
      NORMAL:  'Normal Volatility',
      HIGH:    'High Volatility — wider stops, reduced size',
      EXTREME: 'Extreme Volatility — max caution',
    };
    const base = labels[regime] || 'Normal Volatility';
    if (squeeze?.isSqueezing) {
      return `${base} | BB ${squeeze.intensity} squeeze — directional breakout likely`;
    }
    return base;
  }
}

module.exports = new VolatilityService();
