const { RSI, MACD, EMA, ATR, BollingerBands } = require('technicalindicators');
const { Indicator } = require('../models');
const marketService = require('./market.service');
const logger = require('../utils/logger');
const { setCache, getCache } = require('../database/config/redis');

class AnalysisService {
  async calculateAndStoreIndicators(symbol = 'ETHUSDT', timeframe = '1h') {
    try {
      let ohlcvData = await marketService.getHistoricalData(symbol, timeframe, 200);

      if (ohlcvData.length < 50) {
        // Try fetching fresh data from Binance
        const symbolFormatted = symbol.includes('/') ? symbol : `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
        await marketService.fetchAndStoreOhlcv(symbolFormatted, timeframe, 500);
        ohlcvData = await marketService.getHistoricalData(symbol, timeframe, 200);
      }

      if (ohlcvData.length < 50) {
        throw new Error('Insufficient data for indicator calculation');
      }

      const closes = ohlcvData.map((d) => parseFloat(d.close));
      const highs = ohlcvData.map((d) => parseFloat(d.high));
      const lows = ohlcvData.map((d) => parseFloat(d.low));
      const volumes = ohlcvData.map((d) => parseFloat(d.volume));

      const rsiValues = RSI.calculate({ values: closes, period: 14 });
      const macdValues = MACD.calculate({
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });
      const ema9Values = EMA.calculate({ values: closes, period: 9 });
      const ema21Values = EMA.calculate({ values: closes, period: 21 });
      const ema50Values = EMA.calculate({ values: closes, period: 50 });
      const ema200Values = EMA.calculate({ values: closes, period: 200 });
      const atrValues = ATR.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: 14,
      });
      const bbValues = BollingerBands.calculate({
        values: closes,
        period: 20,
        stdDev: 2,
      });

      const vwap = this.calculateVWAP(ohlcvData.slice(-20));

      const latestCandle = ohlcvData[ohlcvData.length - 1];
      const latestMacd = macdValues[macdValues.length - 1];
      const latestBB = bbValues[bbValues.length - 1];

      const indicator = await Indicator.create({
        symbol,
        timeframe,
        timestamp: latestCandle.timestamp,
        rsi: rsiValues[rsiValues.length - 1] || null,
        macd: latestMacd?.MACD || null,
        macdSignal: latestMacd?.signal || null,
        macdHistogram: latestMacd?.histogram || null,
        ema9: ema9Values[ema9Values.length - 1] || null,
        ema21: ema21Values[ema21Values.length - 1] || null,
        ema50: ema50Values[ema50Values.length - 1] || null,
        ema200: ema200Values[ema200Values.length - 1] || null,
        vwap,
        atr: atrValues[atrValues.length - 1] || null,
        bollingerUpper: latestBB?.upper || null,
        bollingerMiddle: latestBB?.middle || null,
        bollingerLower: latestBB?.lower || null,
      });

      logger.info(`Calculated indicators for ${symbol} ${timeframe}`);
      return indicator;
    } catch (error) {
      logger.error(`Failed to calculate indicators: ${error.message}`);
      throw error;
    }
  }

  calculateVWAP(ohlcvData) {
    let cumulativePV = 0;
    let cumulativeVolume = 0;

    for (const candle of ohlcvData) {
      const typicalPrice =
        (parseFloat(candle.high) + parseFloat(candle.low) + parseFloat(candle.close)) / 3;
      const volume = parseFloat(candle.volume);
      cumulativePV += typicalPrice * volume;
      cumulativeVolume += volume;
    }

    return cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : 0;
  }

  async getLatestIndicators(symbol = 'ETHUSDT', timeframe = '1h') {
    const cacheKey = `indicators:${symbol}:${timeframe}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    let indicator = await Indicator.findOne({
      where: { symbol, timeframe },
      order: [['timestamp', 'DESC']],
    });

    if (!indicator) {
      // Fetch fresh data from Binance before calculating
      const symbolFormatted = symbol.includes('/') ? symbol : `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
      await marketService.fetchAndStoreOhlcv(symbolFormatted, timeframe, 500);
      indicator = await this.calculateAndStoreIndicators(symbol, timeframe);
    }

    await setCache(cacheKey, indicator, 60);
    return indicator;
  }

  async analyzeIndicators(indicator) {
    let bullishScore = 0;
    let bearishScore = 0;
    const details = {};

    if (indicator.rsi) {
      const rsi = parseFloat(indicator.rsi);
      if (rsi < 30) {
        bullishScore += 2;
        details.rsi = { value: rsi, signal: 'Oversold - Bullish' };
      } else if (rsi > 70) {
        bearishScore += 2;
        details.rsi = { value: rsi, signal: 'Overbought - Bearish' };
      } else {
        details.rsi = { value: rsi, signal: 'Neutral' };
      }
    }

    if (indicator.macdHistogram) {
      const hist = parseFloat(indicator.macdHistogram);
      if (hist > 0) {
        bullishScore += 1;
        details.macd = 'Bullish crossover';
      } else {
        bearishScore += 1;
        details.macd = 'Bearish crossover';
      }
    }

    if (indicator.ema9 && indicator.ema21 && indicator.ema50) {
      const ema9 = parseFloat(indicator.ema9);
      const ema21 = parseFloat(indicator.ema21);
      const ema50 = parseFloat(indicator.ema50);

      if (ema9 > ema21 && ema21 > ema50) {
        bullishScore += 2;
        details.ema = 'Bullish EMA alignment';
      } else if (ema9 < ema21 && ema21 < ema50) {
        bearishScore += 2;
        details.ema = 'Bearish EMA alignment';
      } else {
        details.ema = 'Mixed EMA signals';
      }
    }

    if (indicator.bollingerUpper && indicator.bollingerLower && indicator.vwap) {
      const price = parseFloat(indicator.vwap);
      const upper = parseFloat(indicator.bollingerUpper);
      const lower = parseFloat(indicator.bollingerLower);

      if (price < lower) {
        bullishScore += 1;
        details.bollinger = 'Price below lower band - Potential bounce';
      } else if (price > upper) {
        bearishScore += 1;
        details.bollinger = 'Price above upper band - Potential reversal';
      } else {
        details.bollinger = 'Price within bands';
      }
    }

    const totalScore = bullishScore + bearishScore;
    const strength = totalScore > 0 ? (Math.max(bullishScore, bearishScore) / totalScore) * 100 : 0;

    let signal = 'neutral';
    if (bullishScore > bearishScore + 1) {
      signal = 'bullish';
    } else if (bearishScore > bullishScore + 1) {
      signal = 'bearish';
    }

    return { signal, strength, details };
  }
}

module.exports = new AnalysisService();
