const logger = require('../utils/logger');
// redis caching available via ../database/config/redis if needed for S/R levels

class SupportResistanceService {

  // Group nearby price levels (within tolerance%) into single zones
  clusterLevels(prices, tolerancePct = 0.5) {
    if (!prices.length) return [];
    const sorted = [...prices].sort((a, b) => a - b);
    const clusters = [];
    let current = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const diff = (sorted[i] - current[0]) / current[0] * 100;
      if (diff <= tolerancePct) {
        current.push(sorted[i]);
      } else {
        clusters.push(current.reduce((a, b) => a + b, 0) / current.length);
        current = [sorted[i]];
      }
    }
    clusters.push(current.reduce((a, b) => a + b, 0) / current.length);
    return clusters;
  }

  /**
   * Calculate S/R levels from historical OHLCV data
   * Uses: pivot highs/lows + round psychological numbers
   */
  calculateLevels(ohlcvData, currentPrice) {
    try {
      if (!ohlcvData || ohlcvData.length < 20) {
        return { supports: [], resistances: [], nearest: null, analysis: 'Insufficient data' };
      }

      const highs = ohlcvData.map(d => parseFloat(d.high));
      const lows = ohlcvData.map(d => parseFloat(d.low));

      // Find pivot highs (local maxima) and pivot lows (local minima)
      const lookback = 5;
      const pivotHighs = [];
      const pivotLows = [];

      for (let i = lookback; i < highs.length - lookback; i++) {
        let isHigh = true, isLow = true;
        for (let j = i - lookback; j <= i + lookback; j++) {
          if (j !== i) {
            if (highs[j] >= highs[i]) isHigh = false;
            if (lows[j] <= lows[i]) isLow = false;
          }
        }
        if (isHigh) pivotHighs.push(highs[i]);
        if (isLow) pivotLows.push(lows[i]);
      }

      // Add psychological round numbers near current price (±15%)
      const roundLevels = [];
      const magnitude = Math.pow(10, Math.floor(Math.log10(currentPrice)) - 1);
      for (let level = currentPrice * 0.85; level <= currentPrice * 1.15; level += magnitude) {
        const rounded = Math.round(level / magnitude) * magnitude;
        if (Math.abs(rounded - currentPrice) / currentPrice < 0.15) {
          roundLevels.push(rounded);
        }
      }

      // Cluster nearby levels
      const allResistances = this.clusterLevels(
        [...pivotHighs.filter(h => h > currentPrice), ...roundLevels.filter(r => r > currentPrice)]
      ).filter(l => l > currentPrice).sort((a, b) => a - b).slice(0, 4);

      const allSupports = this.clusterLevels(
        [...pivotLows.filter(l => l < currentPrice), ...roundLevels.filter(r => r < currentPrice)]
      ).filter(l => l < currentPrice).sort((a, b) => b - a).slice(0, 4);

      // Nearest S/R
      const nearestResistance = allResistances[0] || null;
      const nearestSupport = allSupports[0] || null;

      // Distance analysis
      const resistanceDist = nearestResistance ? ((nearestResistance - currentPrice) / currentPrice * 100) : null;
      const supportDist = nearestSupport ? ((currentPrice - nearestSupport) / currentPrice * 100) : null;

      // Warning: price very close to resistance = bad time to buy
      let analysis = 'Price in open space';
      if (resistanceDist !== null && resistanceDist < 0.5) {
        analysis = `WARNING: Only ${resistanceDist.toFixed(2)}% from resistance ${nearestResistance?.toFixed(2)}`;
      } else if (supportDist !== null && supportDist < 0.5) {
        analysis = `WARNING: Only ${supportDist.toFixed(2)}% from support ${nearestSupport?.toFixed(2)}`;
      } else if (nearestResistance && nearestSupport) {
        analysis = `Support: $${nearestSupport.toFixed(2)} | Resistance: $${nearestResistance.toFixed(2)}`;
      }

      return {
        supports: allSupports.map(s => parseFloat(s.toFixed(2))),
        resistances: allResistances.map(r => parseFloat(r.toFixed(2))),
        nearestSupport: nearestSupport ? parseFloat(nearestSupport.toFixed(2)) : null,
        nearestResistance: nearestResistance ? parseFloat(nearestResistance.toFixed(2)) : null,
        distanceToResistancePct: resistanceDist ? parseFloat(resistanceDist.toFixed(2)) : null,
        distanceToSupportPct: supportDist ? parseFloat(supportDist.toFixed(2)) : null,
        analysis
      };
    } catch (err) {
      logger.error(`S/R calculation error: ${err.message}`);
      return { supports: [], resistances: [], nearest: null, analysis: 'Error calculating levels' };
    }
  }

  // Returns score adjustment: buying near resistance = bad, buying near support = good
  scoreSR(srLevels, proposedDirection) {
    if (!srLevels) return { boost: 0, warning: null };

    const { distanceToResistancePct, distanceToSupportPct } = srLevels;

    if (proposedDirection === 'bullish') {
      // Don't buy into resistance
      if (distanceToResistancePct !== null && distanceToResistancePct < 0.5) {
        return { boost: -2, warning: `Price only ${distanceToResistancePct}% from resistance - risky BUY` };
      }
      if (distanceToResistancePct !== null && distanceToResistancePct < 1.5) {
        return { boost: -1, warning: `Price close to resistance (${distanceToResistancePct}%)` };
      }
      // Buy near support = excellent entry
      if (distanceToSupportPct !== null && distanceToSupportPct < 1) {
        return { boost: 2, warning: null };
      }
    }

    if (proposedDirection === 'bearish') {
      // Don't short support
      if (distanceToSupportPct !== null && distanceToSupportPct < 0.5) {
        return { boost: -2, warning: `Price only ${distanceToSupportPct}% from support - risky SELL` };
      }
      // Short near resistance = excellent entry
      if (distanceToResistancePct !== null && distanceToResistancePct < 1) {
        return { boost: 2, warning: null };
      }
    }

    return { boost: 0, warning: null };
  }
}

module.exports = new SupportResistanceService();
