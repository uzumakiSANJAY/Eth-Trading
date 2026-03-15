const axios = require('axios');
const { Signal } = require('../models');
const marketService = require('./market.service');
const analysisService = require('./analysis.service');
const patternService = require('./pattern.service');
const newsService = require('./news.service');
const marketIntelService = require('./marketIntel.service');
const divergenceService = require('./divergence.service');
const srService = require('./supportResistance.service');
const structureService = require('./marketStructure.service');
const riskManager = require('./riskManager.service');
const logger = require('../utils/logger');

class SignalService {
  constructor() {
    this.mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001';
  }

  async generateSignal(symbol = 'ETHUSDT', timeframe = '1h') {
    try {
      // --- Circuit breaker check first ---
      const circuitBreaker = await riskManager.checkCircuitBreaker(symbol);
      if (!circuitBreaker.allowed) {
        logger.warn(`Circuit breaker active for ${symbol}: ${circuitBreaker.reason}`);
        return {
          signalType: 'BLOCKED',
          confidence: 0,
          reason: circuitBreaker.reason,
          dailyStats: circuitBreaker.session
        };
      }

      // --- Fetch all base data ---
      const [currentPrice, ohlcvData] = await Promise.all([
        marketService.getCurrentPrice(symbol.includes('/') ? symbol : `${symbol.slice(0, 3)}/${symbol.slice(3)}`),
        marketService.getHistoricalData(symbol, timeframe, 100)
      ]);

      const indicators = await analysisService.getLatestIndicators(symbol, timeframe);
      const indicatorAnalysis = await analysisService.analyzeIndicators(indicators);

      // --- Run all analysis in parallel ---
      const [
        patternResult,
        volumeAnalysis,
        newsResult,
        marketIntelResult,
        mlResult
      ] = await Promise.allSettled([
        (async () => {
          await patternService.detectAndStorePatterns(symbol, timeframe);
          return patternService.getRecentPatterns(symbol, timeframe, 5);
        })(),
        marketService.getVolumeAnalysis(symbol, timeframe),
        newsService.getNewsSentiment(),
        marketIntelService.getAllIntel(symbol),
        axios.post(`${this.mlServiceUrl}/predict`, {
          symbol, timeframe,
          indicators: {
            rsi: parseFloat(indicators.rsi), macd: parseFloat(indicators.macd),
            macdSignal: parseFloat(indicators.macdSignal), ema9: parseFloat(indicators.ema9),
            ema21: parseFloat(indicators.ema21), ema50: parseFloat(indicators.ema50),
            atr: parseFloat(indicators.atr), vwap: parseFloat(indicators.vwap),
          },
        }, { timeout: 5000 })
      ]);

      const patterns = patternResult.status === 'fulfilled' ? patternResult.value : [];
      const volumeData = volumeAnalysis.status === 'fulfilled' ? volumeAnalysis.value : { volumeRatio: 1 };
      const newsSentiment = newsResult.status === 'fulfilled' ? newsResult.value : null;
      const marketIntel = marketIntelResult.status === 'fulfilled' ? marketIntelResult.value : null;
      let mlPrediction = mlResult.status === 'fulfilled' ? mlResult.value.data : null;
      if (!mlPrediction) {
        mlPrediction = {
          direction: indicatorAnalysis.signal === 'bullish' ? 'up' : indicatorAnalysis.signal === 'bearish' ? 'down' : 'neutral',
          probability: 0.5,
        };
      }

      // --- Advanced analysis (uses ohlcvData) ---
      const divergence = divergenceService.analyzeDivergences(ohlcvData, indicators);
      const srLevels = srService.calculateLevels(ohlcvData, currentPrice);
      const structure = structureService.analyzeStructure(ohlcvData);
      const volumeProfile = riskManager.calculateVolumeProfile(ohlcvData);

      // --- Make signal decision ---
      const signalDecision = this.makeSignalDecision(
        indicatorAnalysis, patterns, volumeData, mlPrediction,
        newsSentiment, marketIntel, divergence, srLevels, structure
      );

      if (signalDecision.signalType === 'HOLD' || signalDecision.signalType === 'VETOED') {
        return signalDecision;
      }

      // --- Risk management ---
      const atr = parseFloat(indicators.atr);
      const riskManagement = riskManager.calculateEnhancedRisk(currentPrice, signalDecision.signalType, atr);

      // --- Save signal ---
      const signal = await Signal.create({
        symbol,
        timeframe,
        signalType: signalDecision.signalType,
        confidence: signalDecision.confidence,
        entryPrice: currentPrice,
        entryZoneMin: riskManagement.entryZoneMin,
        entryZoneMax: riskManagement.entryZoneMax,
        stopLoss: riskManagement.stopLoss,
        takeProfit1: riskManagement.takeProfit1,
        takeProfit2: riskManagement.takeProfit2,
        takeProfit3: riskManagement.takeProfit3,
        riskRewardRatio: riskManagement.riskRewardRatio,
        reasoning: {
          indicators: indicatorAnalysis.details,
          patterns: patterns.map(p => ({ type: p.patternType, signal: p.signal, strength: p.strength })),
          mlPrediction,
          volumeAnalysis: volumeData.volumeRatio > 1.5 ? 'High volume' : 'Normal volume',
          newsSentiment: newsSentiment ? { sentiment: newsSentiment.sentiment, score: newsSentiment.score, reason: newsSentiment.reason, impact: newsSentiment.impactLevel } : null,
          marketIntel: marketIntel ? {
            fearGreed: marketIntel.fearGreed,
            fundingRate: marketIntel.fundingRate ? { rate: marketIntel.fundingRate.ratePercent, bias: marketIntel.fundingRate.bias } : null,
            openInterest: marketIntel.openInterest ? { change: marketIntel.openInterest.change4h, trend: marketIntel.openInterest.trend } : null,
            btcTrend: marketIntel.btcTrend ? { trend: marketIntel.btcTrend.trend, change: marketIntel.btcTrend.priceChange4h } : null,
            session: marketIntel.timeFilter ? marketIntel.timeFilter.session : null,
          } : null,
          divergence: { hasBullish: divergence.hasBullishDivergence, hasBearish: divergence.hasBearishDivergence, summary: divergence.summary },
          supportResistance: { nearestSupport: srLevels.nearestSupport, nearestResistance: srLevels.nearestResistance, analysis: srLevels.analysis },
          marketStructure: { trend: structure.trend, bos: structure.bos, choch: structure.choch, summary: structure.summary },
          volumeProfile: volumeProfile ? { poc: volumeProfile.poc, vah: volumeProfile.vah, val: volumeProfile.val } : null,
          tradeManagement: riskManagement.tradeManagement,
          scoreBreakdown: signalDecision.scoreBreakdown,
        },
        timestamp: Date.now(),
        status: 'active',
      });

      logger.info(`Generated ${signalDecision.signalType} signal for ${symbol} ${timeframe} (confidence: ${signalDecision.confidence.toFixed(1)}%)`);
      return signal;
    } catch (error) {
      logger.error(`Failed to generate signal: ${error.message}`);
      throw error;
    }
  }

  makeSignalDecision(indicatorAnalysis, patterns, volumeAnalysis, mlPrediction, newsSentiment, marketIntel, divergence, srLevels, structure) {
    let bullishScore = 0;
    let bearishScore = 0;
    const scoreBreakdown = [];

    // 1. Indicator analysis (max +2)
    if (indicatorAnalysis.signal === 'bullish') { bullishScore += 2; scoreBreakdown.push('Indicators: +2 bullish'); }
    if (indicatorAnalysis.signal === 'bearish') { bearishScore += 2; scoreBreakdown.push('Indicators: +2 bearish'); }

    // 2. Patterns (max +n)
    const bullishPatterns = patterns.filter(p => p.signal === 'bullish').length;
    const bearishPatterns = patterns.filter(p => p.signal === 'bearish').length;
    bullishScore += bullishPatterns;
    bearishScore += bearishPatterns;
    if (bullishPatterns) scoreBreakdown.push(`Patterns: +${bullishPatterns} bullish`);
    if (bearishPatterns) scoreBreakdown.push(`Patterns: +${bearishPatterns} bearish`);

    // 3. Volume
    if (volumeAnalysis.volumeRatio > 1.5) {
      if (indicatorAnalysis.signal === 'bullish') { bullishScore += 1; scoreBreakdown.push('High volume: +1 bullish'); }
      if (indicatorAnalysis.signal === 'bearish') { bearishScore += 1; scoreBreakdown.push('High volume: +1 bearish'); }
    }

    // 4. ML prediction
    if (mlPrediction) {
      if (mlPrediction.direction === 'up' && mlPrediction.probability > 0.6) { bullishScore += 2; scoreBreakdown.push(`ML: +2 bullish (${(mlPrediction.probability*100).toFixed(0)}%)`); }
      else if (mlPrediction.direction === 'down' && mlPrediction.probability > 0.6) { bearishScore += 2; scoreBreakdown.push(`ML: +2 bearish (${(mlPrediction.probability*100).toFixed(0)}%)`); }
    }

    // 5. News sentiment
    if (newsSentiment) {
      const { boost, direction } = newsService.sentimentToSignalScore(newsSentiment);
      if (direction === 'bullish' && boost > 0) { bullishScore += boost; scoreBreakdown.push(`News: +${boost} bullish`); }
      else if (direction === 'bearish' && boost > 0) { bearishScore += boost; scoreBreakdown.push(`News: +${boost} bearish`); }
    }

    // --- Determine preliminary direction ---
    const prelimDirection = bullishScore > bearishScore ? 'bullish' : bearishScore > bullishScore ? 'bearish' : 'neutral';

    // 6. Market Intel (with VETO capability)
    if (marketIntel) {
      const intelScore = marketIntelService.scoreMarketIntel(marketIntel, prelimDirection);
      if (intelScore.vetoed) {
        return { signalType: 'VETOED', confidence: 0, vetoReason: intelScore.vetoReason, scoreBreakdown };
      }
      bullishScore += intelScore.bullishBoost;
      bearishScore += intelScore.bearishBoost;
      if (intelScore.bullishBoost !== 0) scoreBreakdown.push(`MarketIntel: ${intelScore.bullishBoost > 0 ? '+' : ''}${intelScore.bullishBoost} bullish`);
      if (intelScore.bearishBoost !== 0) scoreBreakdown.push(`MarketIntel: ${intelScore.bearishBoost > 0 ? '+' : ''}${intelScore.bearishBoost} bearish`);
    }

    // 7. Divergence (high weight - very reliable signal)
    if (divergence) {
      const divScore = divergenceService.scoreDiv(divergence, prelimDirection);
      if (divScore.direction === 'bullish') { bullishScore += divScore.boost; if (divScore.boost) scoreBreakdown.push(`Divergence: +${divScore.boost} bullish`); }
      else if (divScore.direction === 'bearish') { bearishScore += divScore.boost; if (divScore.boost) scoreBreakdown.push(`Divergence: +${divScore.boost} bearish`); }
      else if (divScore.direction === 'warning') {
        // Counter-divergence - reduce score of proposed direction
        if (prelimDirection === 'bullish') { bullishScore += divScore.boost; scoreBreakdown.push(`Divergence WARNING: ${divScore.boost} (counter)`); }
        else { bearishScore += divScore.boost; scoreBreakdown.push(`Divergence WARNING: ${divScore.boost} (counter)`); }
      }
    }

    // 8. Support/Resistance
    if (srLevels) {
      const srScore = srService.scoreSR(srLevels, prelimDirection);
      if (srScore.boost > 0) {
        if (prelimDirection === 'bullish') { bullishScore += srScore.boost; scoreBreakdown.push(`S/R: +${srScore.boost} (near support)`); }
        else { bearishScore += srScore.boost; scoreBreakdown.push(`S/R: +${srScore.boost} (near resistance)`); }
      } else if (srScore.boost < 0) {
        if (prelimDirection === 'bullish') { bullishScore += srScore.boost; scoreBreakdown.push(`S/R: ${srScore.boost} warning: ${srScore.warning}`); }
        else { bearishScore += srScore.boost; scoreBreakdown.push(`S/R: ${srScore.boost} warning: ${srScore.warning}`); }
      }
    }

    // 9. Market Structure (with VETO for CHoCH)
    if (structure) {
      const structScore = structureService.scoreStructure(structure, prelimDirection);
      if (structScore.vetoed) {
        return { signalType: 'VETOED', confidence: 0, vetoReason: structScore.reason, scoreBreakdown };
      }
      if (structScore.boost > 0) {
        if (prelimDirection === 'bullish') { bullishScore += structScore.boost; scoreBreakdown.push(`Structure: +${structScore.boost} (${structure.trend})`); }
        else { bearishScore += structScore.boost; scoreBreakdown.push(`Structure: +${structScore.boost} (${structure.trend})`); }
      } else if (structScore.boost < 0) {
        if (prelimDirection === 'bullish') bullishScore += structScore.boost;
        else bearishScore += structScore.boost;
        scoreBreakdown.push(`Structure: ${structScore.boost} (counter-trend penalty)`);
      }
    }

    // --- Final decision ---
    bullishScore = Math.max(0, bullishScore);
    bearishScore = Math.max(0, bearishScore);
    const totalScore = bullishScore + bearishScore;
    const confidence = totalScore > 0 ? (Math.max(bullishScore, bearishScore) / totalScore) * 100 : 50;

    if (confidence < 65) {
      return { signalType: 'HOLD', confidence, scoreBreakdown, bullishScore, bearishScore };
    }

    if (bullishScore > bearishScore) {
      return { signalType: 'BUY', confidence, scoreBreakdown, bullishScore, bearishScore };
    } else if (bearishScore > bullishScore) {
      return { signalType: 'SELL', confidence, scoreBreakdown, bullishScore, bearishScore };
    }

    return { signalType: 'HOLD', confidence, scoreBreakdown, bullishScore, bearishScore };
  }

  async getLatestSignal(symbol = 'ETHUSDT', timeframe = '1h') {
    return await Signal.findOne({
      where: { symbol, timeframe, status: 'active' },
      order: [['createdAt', 'DESC']],
    });
  }

  async getSignalHistory(symbol = 'ETHUSDT', timeframe = '1h', limit = 50) {
    return await Signal.findAll({
      where: { symbol, timeframe },
      order: [['createdAt', 'DESC']],
      limit,
    });
  }
}

module.exports = new SignalService();
