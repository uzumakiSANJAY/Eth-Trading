const analysisService = require('./analysis.service');
const signalService = require('./signal.service');
const marketService = require('./market.service');
const patternService = require('./pattern.service');
const logger = require('../utils/logger');
const { setCache, getCache } = require('../database/config/redis');

const TIMEFRAME_WEIGHTS = {
  '15m': 0.10,
  '1h': 0.20,
  '4h': 0.30,
  '1d': 0.40,
};

const TIMEFRAMES = ['15m', '1h', '4h', '1d'];

class MultiTimeframeService {
  async analyzeMultiTimeframe(symbol = 'ETHUSDT') {
    const cacheKey = `mtf:${symbol}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    try {
      const symbolFormatted = symbol.includes('/')
        ? symbol
        : `${symbol.slice(0, 3)}/${symbol.slice(3)}`;

      // Analyze all timeframes in parallel
      const timeframeResults = await Promise.allSettled(
        TIMEFRAMES.map((tf) => this._analyzeTimeframe(symbol, symbolFormatted, tf))
      );

      const timeframeAnalyses = {};
      const failedTimeframes = [];

      for (let i = 0; i < TIMEFRAMES.length; i++) {
        const tf = TIMEFRAMES[i];
        const result = timeframeResults[i];
        if (result.status === 'fulfilled') {
          timeframeAnalyses[tf] = result.value;
        } else {
          failedTimeframes.push(tf);
          logger.warn(`MTF analysis failed for ${tf}: ${result.reason?.message}`);
        }
      }

      if (Object.keys(timeframeAnalyses).length === 0) {
        throw new Error('All timeframe analyses failed');
      }

      // Combine all timeframe analyses with weighting
      const combined = this._combineTimeframes(timeframeAnalyses);

      // Get current price
      const currentPrice = await marketService.getCurrentPrice(symbolFormatted);

      // Find best available ATR for risk management (prefer 1h)
      let atr = null;
      for (const tf of ['1h', '4h', '15m', '1d']) {
        if (timeframeAnalyses[tf]?.indicators?.atr) {
          atr = parseFloat(timeframeAnalyses[tf].indicators.atr);
          break;
        }
      }

      let riskManagement = null;
      if (combined.signalType !== 'HOLD' && atr) {
        riskManagement = signalService.calculateRiskManagement(
          currentPrice,
          combined.signalType,
          atr
        );
      }

      const result = {
        symbol,
        timestamp: Date.now(),
        currentPrice,
        combined: {
          signalType: combined.signalType,
          confidence: combined.confidence,
          overallTrend: combined.overallTrend,
          scores: combined.scores,
          reasoning: combined.reasoning,
        },
        riskManagement,
        timeframes: timeframeAnalyses,
        failedTimeframes,
      };

      await setCache(cacheKey, result, 120);
      return result;
    } catch (error) {
      logger.error(`Multi-timeframe analysis failed: ${error.message}`);
      throw error;
    }
  }

  async _analyzeTimeframe(symbol, symbolFormatted, timeframe) {
    // Fetch fresh OHLCV data
    await marketService.fetchAndStoreOhlcv(symbolFormatted, timeframe, 500);

    // Calculate indicators
    const indicators = await analysisService.calculateAndStoreIndicators(symbol, timeframe);

    // Analyze indicators
    const analysis = await analysisService.analyzeIndicators(indicators);

    // Detect and get patterns
    await patternService.detectAndStorePatterns(symbol, timeframe);
    const patterns = await patternService.getRecentPatterns(symbol, timeframe, 5);

    // Volume analysis
    const volumeAnalysis = await marketService.getVolumeAnalysis(symbol, timeframe);

    return {
      timeframe,
      indicators,
      analysis,
      patterns: patterns.map((p) => ({
        type: p.patternType,
        signal: p.signal,
        strength: p.strength,
      })),
      volumeAnalysis,
    };
  }

  _combineTimeframes(timeframeAnalyses) {
    let weightedBullish = 0;
    let weightedBearish = 0;
    let totalWeight = 0;
    const reasoning = {};

    for (const [tf, data] of Object.entries(timeframeAnalyses)) {
      const weight = TIMEFRAME_WEIGHTS[tf] || 0.1;
      totalWeight += weight;

      const analysis = data.analysis;

      // Score based on analysis signal and strength
      if (analysis.signal === 'bullish') {
        weightedBullish += weight * (analysis.strength / 100);
      } else if (analysis.signal === 'bearish') {
        weightedBearish += weight * (analysis.strength / 100);
      }

      // Pattern influence (scaled by weight)
      const bullishPatterns = data.patterns.filter((p) => p.signal === 'bullish');
      const bearishPatterns = data.patterns.filter((p) => p.signal === 'bearish');
      weightedBullish += weight * 0.15 * bullishPatterns.length;
      weightedBearish += weight * 0.15 * bearishPatterns.length;

      // Volume confirmation
      if (data.volumeAnalysis && data.volumeAnalysis.volumeRatio > 1.5) {
        if (analysis.signal === 'bullish') weightedBullish += weight * 0.1;
        if (analysis.signal === 'bearish') weightedBearish += weight * 0.1;
      }

      reasoning[tf] = {
        signal: analysis.signal,
        strength: analysis.strength,
        weight,
        details: analysis.details,
        patternCount: {
          bullish: bullishPatterns.length,
          bearish: bearishPatterns.length,
        },
        volumeRatio: data.volumeAnalysis?.volumeRatio || 0,
      };
    }

    // Calculate confidence
    const totalScore = weightedBullish + weightedBearish;
    const confidence =
      totalScore > 0
        ? (Math.max(weightedBullish, weightedBearish) / totalScore) * 100
        : 50;

    // Determine overall trend (require 20% margin)
    let overallTrend = 'neutral';
    if (weightedBullish > weightedBearish * 1.2) {
      overallTrend = 'bullish';
    } else if (weightedBearish > weightedBullish * 1.2) {
      overallTrend = 'bearish';
    }

    // Signal decision
    let signalType = 'HOLD';
    if (confidence >= 60) {
      if (weightedBullish > weightedBearish) {
        signalType = 'BUY';
      } else if (weightedBearish > weightedBullish) {
        signalType = 'SELL';
      }
    }

    return {
      signalType,
      confidence: parseFloat(confidence.toFixed(2)),
      overallTrend,
      reasoning,
      scores: {
        bullish: parseFloat(weightedBullish.toFixed(4)),
        bearish: parseFloat(weightedBearish.toFixed(4)),
      },
    };
  }
}

module.exports = new MultiTimeframeService();
