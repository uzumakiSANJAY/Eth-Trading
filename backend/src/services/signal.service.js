const axios = require('axios');
const { Op } = require('sequelize');
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
const volatilityService = require('./volatility.service');
const redditService = require('./reddit.service');
const onchainService = require('./onchain.service');
const { setCache, getCache } = require('../database/config/redis');
const logger = require('../utils/logger');

// Minimum minutes between signals for the same symbol+timeframe
const SIGNAL_COOLDOWN_MINUTES = 15;

class SignalService {
  constructor() {
    this.mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001';
  }

  /**
   * Check if a new signal can be generated (cooldown + circuit breaker).
   * Returns { allowed, reason }.
   */
  async _canGenerate(symbol, timeframe) {
    // 1. Cooldown — prevent duplicate signals within SIGNAL_COOLDOWN_MINUTES
    const cooldownKey = `signal:cooldown:${symbol}:${timeframe}`;
    const cooldownHit = await getCache(cooldownKey);
    if (cooldownHit) {
      return { allowed: false, reason: `Cooldown active — wait ${SIGNAL_COOLDOWN_MINUTES} min between signals` };
    }

    // 2. Circuit breaker
    const cb = await riskManager.checkCircuitBreaker(symbol);
    if (!cb.allowed) return { allowed: false, reason: cb.reason, dailyStats: cb.session };

    return { allowed: true };
  }

  /**
   * Close the previous active BUY/SELL signal if current price has hit its SL or TP.
   * Records win/loss into the circuit breaker so it actually works.
   */
  async _autoClosePreviousSignal(symbol, timeframe, currentPrice) {
    try {
      const previous = await Signal.findOne({
        where: { symbol, timeframe, status: 'active', signalType: { [Op.in]: ['BUY', 'SELL'] } },
        order: [['createdAt', 'DESC']],
      });

      if (!previous) return;

      const entry = parseFloat(previous.entryPrice);
      const sl    = parseFloat(previous.stopLoss);
      const tp1   = parseFloat(previous.takeProfit1);
      const isBuy = previous.signalType === 'BUY';

      let hitLevel = null;
      let won = false;

      if (isBuy) {
        if (currentPrice <= sl)  { hitLevel = 'SL';  won = false; }
        else if (currentPrice >= tp1) { hitLevel = 'TP1'; won = true; }
      } else {
        if (currentPrice >= sl)  { hitLevel = 'SL';  won = false; }
        else if (currentPrice <= tp1) { hitLevel = 'TP1'; won = true; }
      }

      if (!hitLevel) return; // still open

      const pnlPct = ((currentPrice - entry) / entry * 100) * (isBuy ? 1 : -1);

      await previous.update({
        status: 'closed',
        closedAt: new Date(),
        exitPrice: currentPrice,
        profitLossPercent: parseFloat(pnlPct.toFixed(2)),
      });

      // Now the circuit breaker actually gets trade results
      await riskManager.recordTradeResult(symbol, pnlPct, won);

      logger.info(`Auto-closed ${previous.signalType} signal at ${hitLevel}: ${pnlPct.toFixed(2)}%`);
    } catch (err) {
      logger.error(`Auto-close previous signal failed: ${err.message}`);
    }
  }

  async generateSignal(symbol = 'ETHUSDT', timeframe = '1h') {
    try {
      // --- Gate checks (cooldown + circuit breaker) ---
      const gate = await this._canGenerate(symbol, timeframe);
      if (!gate.allowed) {
        logger.warn(`Signal blocked for ${symbol}: ${gate.reason}`);
        return { signalType: 'BLOCKED', confidence: 0, reason: gate.reason, dailyStats: gate.dailyStats };
      }

      // --- Fetch all base data ---
      const [currentPrice, ohlcvData] = await Promise.all([
        marketService.getCurrentPrice(symbol.includes('/') ? symbol : `${symbol.slice(0, 3)}/${symbol.slice(3)}`),
        marketService.getHistoricalData(symbol, timeframe, 100)
      ]);

      // Auto-close previous signal now that we have a fresh price
      await this._autoClosePreviousSignal(symbol, timeframe, currentPrice);

      const [indicators, indicatorHistory] = await Promise.all([
        analysisService.getLatestIndicators(symbol, timeframe),
        analysisService.getIndicatorHistory(symbol, timeframe, 50),
      ]);
      const indicatorAnalysis = await analysisService.analyzeIndicators(indicators, currentPrice);

      // --- Run all analysis in parallel ---
      const [
        patternResult,
        volumeAnalysis,
        newsResult,
        marketIntelResult,
        mlResult,
        redditResult,
        onchainResult
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
            ema200: parseFloat(indicators.ema200) || 0,
            atr: parseFloat(indicators.atr), vwap: parseFloat(indicators.vwap),
            adx: parseFloat(indicators.adx) || 25,
            bbWidth: parseFloat(indicators.bbWidth) || 4,
            close: currentPrice, // required for correct price_to_ema / price_to_vwap features
          },
        }, { timeout: 5000 }),
        redditService.getSentiment(),
        onchainService.getAllOnchain(symbol),
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
      const redditSentiment = redditResult?.status === 'fulfilled' ? redditResult.value : null;
      const onchainData = onchainResult?.status === 'fulfilled' ? onchainResult.value : null;

      // --- Advanced analysis (uses ohlcvData) ---
      const divergence = divergenceService.analyzeDivergences(ohlcvData, indicators, indicatorHistory);
      const srLevels = srService.calculateLevels(ohlcvData, currentPrice);
      const structure = structureService.analyzeStructure(ohlcvData);
      const volumeProfile = riskManager.calculateVolumeProfile(ohlcvData);

      // --- 4h multi-timeframe confirmation (higher timeframe bias) ---
      let htfBias = null;
      if (timeframe !== '4h' && timeframe !== '1d') {
        try {
          const indicators4h = await analysisService.getLatestIndicators(symbol, '4h');
          if (indicators4h) {
            const analysis4h = await analysisService.analyzeIndicators(indicators4h, currentPrice);
            htfBias = analysis4h.signal; // 'bullish' | 'bearish' | 'neutral'
          }
        } catch (e) {
          logger.warn(`HTF 4h fetch failed: ${e.message}`);
        }
      }

      // --- Volatility regime + BB squeeze (computed before makeSignalDecision so it can adapt thresholds) ---
      const atrForRegime     = parseFloat(indicators.atr) || 0;
      const volatilityRegime = volatilityService.classifyRegime(atrForRegime, currentPrice);
      const bbSqueeze        = volatilityService.detectBBSqueeze(ohlcvData);

      // --- Make signal decision ---
      const signalDecision = this.makeSignalDecision(
        indicatorAnalysis, patterns, volumeData, mlPrediction,
        newsSentiment, marketIntel, divergence, srLevels, structure,
        redditSentiment, onchainData, volumeProfile, currentPrice, htfBias,
        volatilityRegime, bbSqueeze
      );

      // --- Risk management (regime-aware SL/TP) ---
      const atr = atrForRegime; // already parsed above
      const riskManagement = riskManager.calculateEnhancedRisk(currentPrice, signalDecision.signalType, atr, null, volatilityRegime);

      // Position sizing (default $10k account, 1.5% risk) — wired into reasoning
      const positionSize = riskManager.calculatePositionSize(10000, 1.5, currentPrice, riskManagement.stopLoss, atr);

      const sharedReasoning = {
        indicators: indicatorAnalysis.details,
        patterns: patterns.map(p => ({ type: p.patternType, signal: p.signal, strength: p.strength })),
        volatility: {
          regime:      volatilityRegime,
          bbSqueeze,
          description: volatilityService.describe(volatilityRegime, bbSqueeze),
        },
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
        redditSentiment: redditSentiment ? {
          sentiment: redditSentiment.sentiment,
          score: redditSentiment.score,
          intensity: redditSentiment.intensity,
          topTitles: redditSentiment.topTitles?.slice(0, 3)
        } : null,
        onchain: onchainData ? {
          longShortBias: onchainData.longShortRatio?.bias,
          topTraderBias: onchainData.topTraderRatio?.bias,
          takerBias: onchainData.takerRatio?.bias,
          compositeBias: onchainData.compositeBias,
          tvlTrend: onchainData.defiTVL?.trend
        } : null,
        tradeManagement: riskManagement.tradeManagement,
        positionSizing: positionSize,
        scoreBreakdown: signalDecision.scoreBreakdown,
      };

      // --- HOLD / VETOED: save to DB for audit trail, skip setting cooldown ---
      if (signalDecision.signalType === 'HOLD' || signalDecision.signalType === 'VETOED') {
        const holdSignal = await Signal.create({
          symbol, timeframe,
          signalType: signalDecision.signalType,
          confidence: signalDecision.confidence,
          entryPrice: currentPrice,
          reasoning: {
            ...sharedReasoning,
            vetoReason: signalDecision.vetoReason || null,
          },
          timestamp: Date.now(),
          status: 'closed', // not tradeable; mark closed immediately
        });
        logger.info(`${signalDecision.signalType} recorded for ${symbol} ${timeframe} (confidence: ${signalDecision.confidence.toFixed(1)}%)`);
        return holdSignal;
      }

      // --- Save actionable BUY/SELL signal ---
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
        reasoning: sharedReasoning,
        timestamp: Date.now(),
        status: 'active',
      });

      // Set cooldown so the same symbol+timeframe can't generate again too soon
      await setCache(
        `signal:cooldown:${symbol}:${timeframe}`,
        { generatedAt: Date.now(), signalId: signal.id },
        SIGNAL_COOLDOWN_MINUTES * 60
      );

      logger.info(`Generated ${signalDecision.signalType} signal for ${symbol} ${timeframe} (confidence: ${signalDecision.confidence.toFixed(1)}%)`);
      return signal;
    } catch (error) {
      logger.error(`Failed to generate signal: ${error.message}`);
      throw error;
    }
  }

  makeSignalDecision(indicatorAnalysis, patterns, volumeAnalysis, mlPrediction, newsSentiment, marketIntel, divergence, srLevels, structure, redditSentiment = null, onchainData = null, volumeProfile = null, currentPrice = null, htfBias = null, volatilityRegime = 'NORMAL', bbSqueeze = {}) {
    try {
    let bullishScore = 0;
    let bearishScore = 0;
    const scoreBreakdown = [];

    // Regime-aware adaptations (min confidence, ADX bypass, etc.)
    const adaptations = volatilityService.getAdaptations(volatilityRegime, bbSqueeze);
    scoreBreakdown.push(`Volatility: ${volatilityRegime}${bbSqueeze?.isSqueezing ? ` | BB ${bbSqueeze.intensity} squeeze` : ''}`);

    // --- ADX: ranging market filter ---
    // Bypass during a BB squeeze — ADX is structurally low in a squeeze but the
    // directional breakout that follows is one of the highest-probability setups.
    if (indicatorAnalysis.isRanging && !adaptations.bypassAdxFilter) {
      return {
        signalType: 'HOLD',
        confidence: 45,
        scoreBreakdown: ['ADX < 20: ranging market — signal suppressed'],
        bullishScore: 0,
        bearishScore: 0,
        vetoReason: 'ADX < 20: choppy/ranging market',
      };
    }
    if (indicatorAnalysis.isRanging && adaptations.bypassAdxFilter) {
      scoreBreakdown.push('ADX < 20 bypassed — BB squeeze detected, breakout setup active');
    }

    // 1. Indicator analysis (max +2)
    if (indicatorAnalysis.signal === 'bullish') { bullishScore += 2; scoreBreakdown.push('Indicators: +2 bullish'); }
    if (indicatorAnalysis.signal === 'bearish') { bearishScore += 2; scoreBreakdown.push('Indicators: +2 bearish'); }

    // 2. Patterns (capped at +3 each side — prevents a single candle with many patterns dominating)
    const MAX_PATTERN_SCORE = 3;
    const bullishPatterns = Math.min(MAX_PATTERN_SCORE, patterns.filter(p => p.signal === 'bullish').length);
    const bearishPatterns = Math.min(MAX_PATTERN_SCORE, patterns.filter(p => p.signal === 'bearish').length);
    bullishScore += bullishPatterns;
    bearishScore += bearishPatterns;
    if (bullishPatterns) scoreBreakdown.push(`Patterns: +${bullishPatterns} bullish (capped at ${MAX_PATTERN_SCORE})`);
    if (bearishPatterns) scoreBreakdown.push(`Patterns: +${bearishPatterns} bearish (capped at ${MAX_PATTERN_SCORE})`);

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

    // 10. Reddit social sentiment
    if (redditSentiment) {
      const redditScore = redditService.scoreSentiment(redditSentiment, prelimDirection);
      if (redditScore.boost > 0) {
        if (prelimDirection === 'bullish') { bullishScore += redditScore.boost; scoreBreakdown.push(`Reddit: +${redditScore.boost} (${redditSentiment.intensity} ${redditSentiment.sentiment})`); }
        else { bearishScore += redditScore.boost; scoreBreakdown.push(`Reddit: +${redditScore.boost} (${redditSentiment.intensity} ${redditSentiment.sentiment})`); }
      } else if (redditScore.boost < 0) {
        if (prelimDirection === 'bullish') { bullishScore += redditScore.boost; scoreBreakdown.push(`Reddit: ${redditScore.boost} counter-signal`); }
        else { bearishScore += redditScore.boost; scoreBreakdown.push(`Reddit: ${redditScore.boost} counter-signal`); }
      }
    }

    // 11. On-chain / derivatives data
    if (onchainData) {
      const onchainScore = onchainService.scoreOnchain(onchainData, prelimDirection);
      if (onchainScore.boost > 0) {
        if (prelimDirection === 'bullish') { bullishScore += onchainScore.boost; scoreBreakdown.push(`On-chain: +${onchainScore.boost} (${onchainData.compositeBias})`); }
        else { bearishScore += onchainScore.boost; scoreBreakdown.push(`On-chain: +${onchainScore.boost} (${onchainData.compositeBias})`); }
      } else if (onchainScore.boost < 0) {
        if (prelimDirection === 'bullish') { bullishScore += onchainScore.boost; scoreBreakdown.push(`On-chain: ${onchainScore.boost} counter`); }
        else { bearishScore += onchainScore.boost; scoreBreakdown.push(`On-chain: ${onchainScore.boost} counter`); }
      }
    }

    // 12. Volume Profile — POC is a price magnet; VAH/VAL are value area boundaries
    // Trading in the direction of POC increases probability of follow-through
    if (volumeProfile && currentPrice) {
      const { poc, vah, val } = volumeProfile;
      const prelimDir = bullishScore > bearishScore ? 'bullish' : 'bearish';
      if (prelimDir === 'bullish' && currentPrice < poc) {
        bullishScore += 1;
        scoreBreakdown.push(`Vol Profile: +1 (price below POC $${poc} — upside magnet)`);
      } else if (prelimDir === 'bearish' && currentPrice > poc) {
        bearishScore += 1;
        scoreBreakdown.push(`Vol Profile: +1 (price above POC $${poc} — downside magnet)`);
      }
      // Price near Value Area High (resistance) on a BUY = risk; near VAL on SELL = risk
      if (prelimDir === 'bullish' && vah && currentPrice > vah * 0.998) {
        bullishScore -= 1;
        scoreBreakdown.push(`Vol Profile: -1 (at/above VAH $${vah} — value area resistance)`);
      } else if (prelimDir === 'bearish' && val && currentPrice < val * 1.002) {
        bearishScore -= 1;
        scoreBreakdown.push(`Vol Profile: -1 (at/below VAL $${val} — value area support)`);
      }
    }

    // 13. Higher Timeframe (4h) Bias — confirms or contradicts the proposed direction
    // A 1h BUY against a 4h bearish trend is a counter-trend trade; penalize.
    // A 1h BUY with 4h bullish confirmation is high-probability; boost.
    if (htfBias && htfBias !== 'neutral') {
      const prelimDir = bullishScore > bearishScore ? 'bullish' : 'bearish';
      if (htfBias === prelimDir) {
        if (prelimDir === 'bullish') bullishScore += 2;
        else bearishScore += 2;
        scoreBreakdown.push(`HTF 4h: +2 (4h trend aligns — ${htfBias})`);
      } else {
        if (prelimDir === 'bullish') bullishScore -= 2;
        else bearishScore -= 2;
        scoreBreakdown.push(`HTF 4h: -2 (4h trend opposes — ${htfBias}, counter-trend trade)`);
      }
    }

    // --- Final decision ---
    bullishScore = Math.max(0, bullishScore);
    bearishScore = Math.max(0, bearishScore);
    const totalScore = bullishScore + bearishScore;

    // Confidence = blend of ratio (alignment) and magnitude (how many signals confirm).
    // Pure ratio formula (old) gave identical confidence for bull=2/bear=1 and bull=10/bear=5.
    // Now: higher absolute scores push confidence up, not just the ratio.
    // Updated max meaningful score to 18 to account for the 4 new factors (ADX, EMA200, VolProfile, HTF).
    const MAX_MEANINGFUL_SCORE = 18;
    const ratio = totalScore > 0 ? Math.max(bullishScore, bearishScore) / totalScore : 0.5;
    const magnitude = Math.min(1.0, Math.max(bullishScore, bearishScore) / MAX_MEANINGFUL_SCORE);
    const confidence = totalScore > 0
      ? Math.min(95, (ratio * 60) + (magnitude * 35))
      : 50;

    if (confidence < adaptations.minConfidence) {
      return { signalType: 'HOLD', confidence, scoreBreakdown, bullishScore, bearishScore };
    }

    if (bullishScore > bearishScore) {
      return { signalType: 'BUY', confidence, scoreBreakdown, bullishScore, bearishScore };
    } else if (bearishScore > bullishScore) {
      return { signalType: 'SELL', confidence, scoreBreakdown, bullishScore, bearishScore };
    }

    return { signalType: 'HOLD', confidence, scoreBreakdown, bullishScore, bearishScore };
    } catch (err) {
      logger.error(`makeSignalDecision error: ${err.message}`);
      return { signalType: 'HOLD', confidence: 50, scoreBreakdown: [`Error: ${err.message}`], bullishScore: 0, bearishScore: 0 };
    }
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
