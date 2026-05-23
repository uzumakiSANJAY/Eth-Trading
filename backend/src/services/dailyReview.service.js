const { Op } = require('sequelize');
const { Signal, Pattern, Ohlcv, Indicator } = require('../models');
const marketService = require('./market.service');
const analysisService = require('./analysis.service');
const srService = require('./supportResistance.service');
const structureService = require('./marketStructure.service');
const breakoutService = require('./breakout.service');
const logger = require('../utils/logger');

class DailyReviewService {
  /**
   * Build a comprehensive daily market review:
   *  - Price action summary for the day
   *  - All signals generated (BUY/SELL/HOLD/VETOED) with outcomes
   *  - Candlestick patterns detected
   *  - Breakout events (S/R breaks, BB squeeze, volume spikes)
   *  - Missed opportunity analysis (HOLD/VETOED where price moved strongly)
   *  - Loss optimization recommendations
   */
  async getDailyReview(symbol = 'ETHUSDT', timeframe = '1h') {
    try {
      // Day boundary: midnight UTC
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const startTs = todayStart.getTime();
      const endTs = Date.now();

      const [todayCandles, todaySignals, todayPatterns, latestIndicators] = await Promise.all([
        Ohlcv.findAll({
          where: { symbol, timeframe, timestamp: { [Op.between]: [startTs, endTs] } },
          order: [['timestamp', 'ASC']],
        }),
        Signal.findAll({
          where: { symbol, timeframe, createdAt: { [Op.gte]: todayStart } },
          order: [['createdAt', 'ASC']],
        }),
        Pattern.findAll({
          where: { symbol, timeframe, timestamp: { [Op.gte]: startTs } },
          order: [['timestamp', 'ASC']],
        }),
        Indicator.findOne({
          where: { symbol, timeframe },
          order: [['timestamp', 'DESC']],
        }),
      ]);

      // Fetch a larger window for S/R context if we have few candles today
      const contextCandles = todayCandles.length >= 20
        ? todayCandles
        : await Ohlcv.findAll({
            where: { symbol, timeframe },
            order: [['timestamp', 'DESC']],
            limit: 100,
          }).then(rows => rows.reverse());

      // --- Price Action Summary ---
      const priceAction = this._buildPriceAction(todayCandles);

      // --- Signal Analysis ---
      const signalAnalysis = this._analyzeSignals(todaySignals);

      // --- Pattern Summary ---
      const patternSummary = this._summarizePatterns(todayPatterns);

      // --- Breakout Analysis ---
      const currentPrice = priceAction.close || parseFloat(contextCandles[contextCandles.length - 1]?.close || 0);
      const srLevels = srService.calculateLevels(contextCandles, currentPrice);
      const volumeData = await marketService.getVolumeAnalysis(symbol, timeframe, 24);
      const breakouts = breakoutService.analyzeBreakouts(
        todayCandles.length >= 2 ? todayCandles : contextCandles.slice(-24),
        latestIndicators,
        srLevels,
        volumeData.avgVolume
      );

      // --- Market Structure ---
      const structure = structureService.analyzeStructure(contextCandles);

      // --- Missed Opportunities ---
      const missedOpportunities = this._findMissedOpportunities(todaySignals, todayCandles, priceAction);

      // --- Loss Optimization ---
      const lossOptimization = this._buildLossOptimization(
        todaySignals, breakouts, structure, latestIndicators, missedOpportunities
      );

      // --- Overall Day Summary ---
      const daySummary = this._buildDaySummary(
        priceAction, signalAnalysis, breakouts, structure, missedOpportunities, lossOptimization
      );

      return {
        date: todayStart.toISOString().split('T')[0],
        symbol,
        timeframe,
        generatedAt: new Date().toISOString(),
        priceAction,
        signalAnalysis,
        patternSummary,
        breakouts,
        marketStructure: structure,
        supportResistance: {
          supports: srLevels.supports,
          resistances: srLevels.resistances,
          nearestSupport: srLevels.nearestSupport,
          nearestResistance: srLevels.nearestResistance,
          analysis: srLevels.analysis,
        },
        missedOpportunities,
        lossOptimization,
        daySummary,
      };
    } catch (err) {
      logger.error(`Daily review error: ${err.message}`);
      throw err;
    }
  }

  _buildPriceAction(candles) {
    if (!candles.length) {
      return { open: null, high: null, low: null, close: null, changePercent: null, candleCount: 0, direction: 'unknown' };
    }

    const open = parseFloat(candles[0].open);
    const close = parseFloat(candles[candles.length - 1].close);
    const high = Math.max(...candles.map(c => parseFloat(c.high)));
    const low = Math.min(...candles.map(c => parseFloat(c.low)));
    const changePercent = open > 0 ? parseFloat(((close - open) / open * 100).toFixed(2)) : 0;
    const range = parseFloat((high - low).toFixed(2));
    const totalVolume = parseFloat(candles.reduce((sum, c) => sum + parseFloat(c.volume), 0).toFixed(2));

    // Count bullish vs bearish candles
    const bullishCandles = candles.filter(c => parseFloat(c.close) >= parseFloat(c.open)).length;
    const bearishCandles = candles.length - bullishCandles;

    return {
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      changePercent,
      range,
      totalVolume,
      candleCount: candles.length,
      bullishCandles,
      bearishCandles,
      direction: changePercent > 0.3 ? 'bullish' : changePercent < -0.3 ? 'bearish' : 'sideways',
    };
  }

  _analyzeSignals(signals) {
    const byType = { BUY: [], SELL: [], HOLD: [], VETOED: [], BLOCKED: [] };
    for (const s of signals) {
      (byType[s.signalType] || []).push(s);
    }

    const tradeable = [...byType.BUY, ...byType.SELL];
    const closed = tradeable.filter(s => s.status === 'closed' && s.profitLossPercent !== null);
    const winners = closed.filter(s => parseFloat(s.profitLossPercent) > 0);
    const losers = closed.filter(s => parseFloat(s.profitLossPercent) <= 0);
    const active = tradeable.filter(s => s.status === 'active');

    const totalPnl = closed.reduce((sum, s) => sum + parseFloat(s.profitLossPercent || 0), 0);
    const winRate = closed.length > 0 ? parseFloat((winners.length / closed.length * 100).toFixed(1)) : null;
    const avgWin = winners.length > 0 ? parseFloat((winners.reduce((s, x) => s + parseFloat(x.profitLossPercent), 0) / winners.length).toFixed(2)) : null;
    const avgLoss = losers.length > 0 ? parseFloat((losers.reduce((s, x) => s + parseFloat(x.profitLossPercent), 0) / losers.length).toFixed(2)) : null;

    return {
      total: signals.length,
      tradeable: tradeable.length,
      buyCount: byType.BUY.length,
      sellCount: byType.SELL.length,
      holdCount: byType.HOLD.length,
      vetoedCount: byType.VETOED.length,
      blockedCount: byType.BLOCKED.length,
      active: active.length,
      closed: closed.length,
      winners: winners.length,
      losers: losers.length,
      winRate,
      totalPnlPercent: parseFloat(totalPnl.toFixed(2)),
      avgWinPercent: avgWin,
      avgLossPercent: avgLoss,
      signals: signals.map(s => ({
        id: s.id,
        type: s.signalType,
        status: s.status,
        confidence: parseFloat(s.confidence),
        entryPrice: parseFloat(s.entryPrice),
        stopLoss: s.stopLoss ? parseFloat(s.stopLoss) : null,
        takeProfit1: s.takeProfit1 ? parseFloat(s.takeProfit1) : null,
        exitPrice: s.exitPrice ? parseFloat(s.exitPrice) : null,
        pnlPercent: s.profitLossPercent ? parseFloat(s.profitLossPercent) : null,
        createdAt: s.createdAt,
        closedAt: s.closedAt,
        riskReward: s.riskRewardRatio ? parseFloat(s.riskRewardRatio) : null,
        vetoReason: s.reasoning?.vetoReason || null,
      })),
    };
  }

  _summarizePatterns(patterns) {
    const bySignal = { bullish: [], bearish: [], neutral: [] };
    for (const p of patterns) {
      (bySignal[p.signal] || bySignal.neutral).push(p);
    }

    return {
      total: patterns.length,
      bullish: bySignal.bullish.length,
      bearish: bySignal.bearish.length,
      neutral: bySignal.neutral.length,
      patterns: patterns.map(p => ({
        type: p.patternType,
        signal: p.signal,
        strength: p.strength,
        description: p.description,
        timestamp: p.timestamp,
      })),
      strongestBullish: bySignal.bullish.sort((a, b) => b.strength - a.strength)[0] || null,
      strongestBearish: bySignal.bearish.sort((a, b) => b.strength - a.strength)[0] || null,
    };
  }

  /**
   * Missed opportunity: a HOLD or VETOED signal where the subsequent price move
   * was > 1% in a clear direction — meaning we had the analysis right but blocked the trade.
   */
  _findMissedOpportunities(signals, candles, priceAction) {
    const missed = [];
    const holdVetoed = signals.filter(s => s.signalType === 'HOLD' || s.signalType === 'VETOED');

    for (const signal of holdVetoed) {
      const signalTs = signal.timestamp;
      const entryPrice = parseFloat(signal.entryPrice);
      if (!entryPrice) continue;

      // Find candles after this signal
      const candlesAfter = candles.filter(c => c.timestamp > signalTs);
      if (candlesAfter.length < 2) continue;

      // Look at next 3 candles to see what happened
      const nextCandles = candlesAfter.slice(0, 3);
      const highAfter = Math.max(...nextCandles.map(c => parseFloat(c.high)));
      const lowAfter = Math.min(...nextCandles.map(c => parseFloat(c.low)));

      const bullishMove = parseFloat(((highAfter - entryPrice) / entryPrice * 100).toFixed(2));
      const bearishMove = parseFloat(((entryPrice - lowAfter) / entryPrice * 100).toFixed(2));

      // What direction was the signal leaning?
      const reasoning = signal.reasoning || {};
      const indicatorSignal = reasoning.indicators?.rsi?.signal?.toLowerCase() || '';
      const signalLean = indicatorSignal.includes('bullish') ? 'bullish'
        : indicatorSignal.includes('bearish') ? 'bearish' : null;

      // Classify the missed opportunity
      if (bullishMove > 1.0) {
        missed.push({
          signalType: signal.signalType,
          signalId: signal.id,
          entryPrice,
          signalTimestamp: signalTs,
          direction: 'bullish',
          potentialPnlPct: bullishMove,
          vetoReason: signal.reasoning?.vetoReason || `Signal was ${signal.signalType}`,
          leaned: signalLean,
          scenario: bullishMove > 2.0 ? 'significant_bullish_missed' : 'moderate_bullish_missed',
          description: `Price moved +${bullishMove}% after signal — missed BUY opportunity`,
        });
      } else if (bearishMove > 1.0) {
        missed.push({
          signalType: signal.signalType,
          signalId: signal.id,
          entryPrice,
          signalTimestamp: signalTs,
          direction: 'bearish',
          potentialPnlPct: bearishMove,
          vetoReason: signal.reasoning?.vetoReason || `Signal was ${signal.signalType}`,
          leaned: signalLean,
          scenario: bearishMove > 2.0 ? 'significant_bearish_missed' : 'moderate_bearish_missed',
          description: `Price dropped -${bearishMove}% after signal — missed SELL opportunity`,
        });
      }
    }

    return missed.sort((a, b) => b.potentialPnlPct - a.potentialPnlPct);
  }

  /**
   * Loss optimization: analyze what went wrong with losing trades and what could be improved.
   */
  _buildLossOptimization(signals, breakouts, structure, indicators, missedOpportunities) {
    const tradeable = signals.filter(s => s.signalType === 'BUY' || s.signalType === 'SELL');
    const closed = tradeable.filter(s => s.status === 'closed' && s.profitLossPercent !== null);
    const losers = closed.filter(s => parseFloat(s.profitLossPercent) < 0);
    const winners = closed.filter(s => parseFloat(s.profitLossPercent) > 0);

    const recommendations = [];
    const scenarios = [];

    // --- Analyze losing trades ---
    for (const loss of losers) {
      const pnl = parseFloat(loss.profitLossPercent);
      const reasoning = loss.reasoning || {};

      // Check if ADX was low (ranging market) at trade time
      const adxDetail = reasoning.indicators?.adx;
      if (adxDetail?.value && adxDetail.value < 20) {
        scenarios.push({
          type: 'ranging_market_entry',
          signal: loss.signalType,
          pnlPct: pnl,
          description: `Entered ${loss.signalType} in ranging market (ADX ${adxDetail.value}) — signals unreliable in low-ADX environments`,
        });
      }

      // Check if traded counter-trend
      const marketStructure = reasoning.marketStructure;
      if (marketStructure) {
        const counterTrend = (loss.signalType === 'BUY' && marketStructure.trend === 'downtrend') ||
                             (loss.signalType === 'SELL' && marketStructure.trend === 'uptrend');
        if (counterTrend) {
          scenarios.push({
            type: 'counter_trend_trade',
            signal: loss.signalType,
            pnlPct: pnl,
            description: `Entered ${loss.signalType} against ${marketStructure.trend} — high-risk counter-trend trade`,
          });
        }
      }

      // Check if entered near resistance (for BUY) or near support (for SELL)
      const srData = reasoning.supportResistance;
      if (srData) {
        if (loss.signalType === 'BUY' && srData.nearestResistance) {
          const distPct = ((srData.nearestResistance - parseFloat(loss.entryPrice)) / parseFloat(loss.entryPrice) * 100);
          if (distPct < 1.5) {
            scenarios.push({
              type: 'buy_near_resistance',
              signal: loss.signalType,
              pnlPct: pnl,
              description: `BUY entered only ${distPct.toFixed(1)}% below resistance $${srData.nearestResistance} — minimal room to run`,
            });
          }
        }
        if (loss.signalType === 'SELL' && srData.nearestSupport) {
          const distPct = ((parseFloat(loss.entryPrice) - srData.nearestSupport) / parseFloat(loss.entryPrice) * 100);
          if (distPct < 1.5) {
            scenarios.push({
              type: 'sell_near_support',
              signal: loss.signalType,
              pnlPct: pnl,
              description: `SELL entered only ${distPct.toFixed(1)}% above support $${srData.nearestSupport} — high reversal risk`,
            });
          }
        }
      }
    }

    // --- Breakout-based scenarios ---
    if (breakouts.falseBreakouts.length > 0) {
      scenarios.push({
        type: 'false_breakout_trap',
        count: breakouts.falseBreakouts.length,
        description: `${breakouts.falseBreakouts.length} false breakout${breakouts.falseBreakouts.length > 1 ? 's' : ''} occurred today — entries on initial breakout candle would have been trapped`,
      });
    }

    if (breakouts.volumeConfirmedBreakouts.length > 0 && tradeable.length === 0) {
      scenarios.push({
        type: 'breakout_with_no_signal',
        count: breakouts.volumeConfirmedBreakouts.length,
        description: `${breakouts.volumeConfirmedBreakouts.length} volume-confirmed breakout${breakouts.volumeConfirmedBreakouts.length > 1 ? 's' : ''} occurred but no trade signal was generated — review signal thresholds`,
      });
    }

    // --- Build recommendations ---
    const hasRangingEntry = scenarios.some(s => s.type === 'ranging_market_entry');
    const hasCounterTrend = scenarios.some(s => s.type === 'counter_trend_trade');
    const hasNearResistance = scenarios.some(s => s.type === 'buy_near_resistance' || s.type === 'sell_near_support');
    const hasFalseBreakout = scenarios.some(s => s.type === 'false_breakout_trap');

    if (hasRangingEntry) {
      recommendations.push('Wait for ADX > 25 before entering any directional trade — low ADX means the market is chopping, not trending.');
    }
    if (hasCounterTrend) {
      recommendations.push('Always trade with the market structure trend. Counter-trend entries require very high confluence (CHoCH + strong divergence + pattern).');
    }
    if (hasNearResistance) {
      recommendations.push('Check distance to nearest S/R before entry. Avoid BUY within 1.5% of resistance; avoid SELL within 1.5% of support.');
    }
    if (hasFalseBreakout) {
      recommendations.push('Wait for breakout candle to CLOSE above/below the level — do not enter on the breakout wick. False breakouts trapped buyers/sellers today.');
    }
    if (missedOpportunities.length > 0) {
      const topMissed = missedOpportunities[0];
      recommendations.push(`Review veto/hold logic — ${topMissed.potentialPnlPct}% move was missed after a ${topMissed.signalType} signal. Reason: ${topMissed.vetoReason}`);
    }
    if (breakouts.bbBreakout?.inSqueeze) {
      recommendations.push('BB squeeze detected — price is compressing. Prepare for a breakout. Enter only after the breakout candle closes clearly beyond the band with volume confirmation.');
    }

    // General best practice if no specific issues found
    if (recommendations.length === 0 && losers.length === 0) {
      recommendations.push('Strong day — no significant loss patterns identified. Maintain current risk parameters.');
    }

    const totalPnl = closed.reduce((s, x) => s + parseFloat(x.profitLossPercent || 0), 0);
    const bestMissed = missedOpportunities[0] || null;
    const worstLoss = losers.sort((a, b) => parseFloat(a.profitLossPercent) - parseFloat(b.profitLossPercent))[0] || null;

    return {
      totalTrades: tradeable.length,
      closedTrades: closed.length,
      winners: winners.length,
      losers: losers.length,
      winRate: closed.length > 0 ? parseFloat((winners.length / closed.length * 100).toFixed(1)) : null,
      totalPnlPercent: parseFloat(totalPnl.toFixed(2)),
      scenarios,
      recommendations,
      worstLoss: worstLoss ? {
        type: worstLoss.signalType,
        pnlPct: parseFloat(worstLoss.profitLossPercent),
        entryPrice: parseFloat(worstLoss.entryPrice),
        exitPrice: worstLoss.exitPrice ? parseFloat(worstLoss.exitPrice) : null,
      } : null,
      bestMissedOpportunity: bestMissed,
    };
  }

  _buildDaySummary(priceAction, signalAnalysis, breakouts, structure, missedOpportunities, lossOpt) {
    const parts = [];

    // Price action
    const dir = priceAction.direction;
    if (priceAction.changePercent !== null) {
      parts.push(`ETH ${dir === 'bullish' ? 'rose' : dir === 'bearish' ? 'fell' : 'moved sideways'} ${Math.abs(priceAction.changePercent)}% today (${priceAction.open} → ${priceAction.close})`);
    }

    // Market structure
    if (structure.trend !== 'unknown') {
      parts.push(`market structure: ${structure.summary}`);
    }

    // Signals
    if (signalAnalysis.tradeable > 0) {
      parts.push(`${signalAnalysis.tradeable} trade signal${signalAnalysis.tradeable > 1 ? 's' : ''} generated (${signalAnalysis.winners}W / ${signalAnalysis.losers}L, PnL: ${signalAnalysis.totalPnlPercent > 0 ? '+' : ''}${signalAnalysis.totalPnlPercent}%)`);
    } else {
      parts.push(`no tradeable signals generated today`);
    }

    // Breakouts
    if (breakouts.volumeConfirmedCount > 0) {
      parts.push(`${breakouts.volumeConfirmedCount} volume-confirmed breakout${breakouts.volumeConfirmedCount > 1 ? 's' : ''}`);
    }
    if (breakouts.falseCount > 0) {
      parts.push(`${breakouts.falseCount} false breakout trap${breakouts.falseCount > 1 ? 's' : ''}`);
    }

    // Missed
    if (missedOpportunities.length > 0) {
      parts.push(`${missedOpportunities.length} missed opportunit${missedOpportunities.length > 1 ? 'ies' : 'y'} (up to ${missedOpportunities[0].potentialPnlPct}% potential)`);
    }

    return parts.join(' | ');
  }
}

module.exports = new DailyReviewService();
