const axios = require('axios');
const { Signal } = require('../models');
const marketService = require('./market.service');
const analysisService = require('./analysis.service');
const patternService = require('./pattern.service');
const logger = require('../utils/logger');

class SignalService {
  constructor() {
    this.mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001';
  }

  async generateSignal(symbol = 'ETHUSDT', timeframe = '1h') {
    try {
      const currentPrice = await marketService.getCurrentPrice(
        symbol.includes('/') ? symbol : `${symbol.slice(0, 3)}/${symbol.slice(3)}`
      );

      const indicators = await analysisService.getLatestIndicators(symbol, timeframe);
      const indicatorAnalysis = await analysisService.analyzeIndicators(indicators);

      await patternService.detectAndStorePatterns(symbol, timeframe);
      const patterns = await patternService.getRecentPatterns(symbol, timeframe, 5);

      const volumeAnalysis = await marketService.getVolumeAnalysis(symbol, timeframe);

      let mlPrediction = null;
      try {
        const mlResponse = await axios.post(`${this.mlServiceUrl}/predict`, {
          symbol,
          timeframe,
          indicators: {
            rsi: parseFloat(indicators.rsi),
            macd: parseFloat(indicators.macd),
            macdSignal: parseFloat(indicators.macdSignal),
            ema9: parseFloat(indicators.ema9),
            ema21: parseFloat(indicators.ema21),
            ema50: parseFloat(indicators.ema50),
            atr: parseFloat(indicators.atr),
            vwap: parseFloat(indicators.vwap),
          },
        }, { timeout: 5000 });
        mlPrediction = mlResponse.data;
      } catch (mlError) {
        logger.warn(`ML service unavailable: ${mlError.message}`);
        mlPrediction = {
          direction: indicatorAnalysis.signal === 'bullish' ? 'up' : indicatorAnalysis.signal === 'bearish' ? 'down' : 'neutral',
          probability: 0.5,
        };
      }

      const signalDecision = this.makeSignalDecision(
        indicatorAnalysis,
        patterns,
        volumeAnalysis,
        mlPrediction
      );

      if (signalDecision.signalType === 'HOLD') {
        return signalDecision;
      }

      const atr = parseFloat(indicators.atr);
      const riskManagement = this.calculateRiskManagement(
        currentPrice,
        signalDecision.signalType,
        atr
      );

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
          patterns: patterns.map((p) => ({
            type: p.patternType,
            signal: p.signal,
            strength: p.strength,
          })),
          mlPrediction,
          volumeAnalysis: volumeAnalysis.volumeRatio > 1.5 ? 'High volume' : 'Normal volume',
        },
        timestamp: Date.now(),
        status: 'active',
      });

      logger.info(`Generated ${signalDecision.signalType} signal for ${symbol} ${timeframe}`);
      return signal;
    } catch (error) {
      logger.error(`Failed to generate signal: ${error.message}`);
      throw error;
    }
  }

  makeSignalDecision(indicatorAnalysis, patterns, volumeAnalysis, mlPrediction) {
    let bullishScore = 0;
    let bearishScore = 0;

    if (indicatorAnalysis.signal === 'bullish') bullishScore += 2;
    if (indicatorAnalysis.signal === 'bearish') bearishScore += 2;

    const bullishPatterns = patterns.filter((p) => p.signal === 'bullish').length;
    const bearishPatterns = patterns.filter((p) => p.signal === 'bearish').length;
    bullishScore += bullishPatterns;
    bearishScore += bearishPatterns;

    if (volumeAnalysis.volumeRatio > 1.5) {
      if (indicatorAnalysis.signal === 'bullish') bullishScore += 1;
      if (indicatorAnalysis.signal === 'bearish') bearishScore += 1;
    }

    if (mlPrediction) {
      if (mlPrediction.direction === 'up' && mlPrediction.probability > 0.6) {
        bullishScore += 2;
      } else if (mlPrediction.direction === 'down' && mlPrediction.probability > 0.6) {
        bearishScore += 2;
      }
    }

    const totalScore = bullishScore + bearishScore;
    const confidence = totalScore > 0 ? (Math.max(bullishScore, bearishScore) / totalScore) * 100 : 50;

    if (confidence < 65) {
      return { signalType: 'HOLD', confidence };
    }

    if (bullishScore > bearishScore) {
      return { signalType: 'BUY', confidence };
    } else if (bearishScore > bullishScore) {
      return { signalType: 'SELL', confidence };
    }

    return { signalType: 'HOLD', confidence };
  }

  calculateRiskManagement(currentPrice, signalType, atr) {
    const atrMultiplier = 1.5;
    const stopLossDistance = atr * atrMultiplier;

    let stopLoss, takeProfit1, takeProfit2, takeProfit3, entryZoneMin, entryZoneMax;

    if (signalType === 'BUY') {
      stopLoss = currentPrice - stopLossDistance;
      takeProfit1 = currentPrice + stopLossDistance * 2;
      takeProfit2 = currentPrice + stopLossDistance * 3;
      takeProfit3 = currentPrice + stopLossDistance * 4;
      entryZoneMin = currentPrice * 0.995;
      entryZoneMax = currentPrice * 1.005;
    } else if (signalType === 'SELL') {
      stopLoss = currentPrice + stopLossDistance;
      takeProfit1 = currentPrice - stopLossDistance * 2;
      takeProfit2 = currentPrice - stopLossDistance * 3;
      takeProfit3 = currentPrice - stopLossDistance * 4;
      entryZoneMin = currentPrice * 0.995;
      entryZoneMax = currentPrice * 1.005;
    }

    const riskRewardRatio = Math.abs((takeProfit1 - currentPrice) / (stopLoss - currentPrice));

    return {
      stopLoss: parseFloat(stopLoss.toFixed(2)),
      takeProfit1: parseFloat(takeProfit1.toFixed(2)),
      takeProfit2: parseFloat(takeProfit2.toFixed(2)),
      takeProfit3: parseFloat(takeProfit3.toFixed(2)),
      entryZoneMin: parseFloat(entryZoneMin.toFixed(2)),
      entryZoneMax: parseFloat(entryZoneMax.toFixed(2)),
      riskRewardRatio: parseFloat(riskRewardRatio.toFixed(2)),
    };
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
