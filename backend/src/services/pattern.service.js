const { Pattern } = require('../models');
const marketService = require('./market.service');
const logger = require('../utils/logger');

class PatternService {
  async detectAndStorePatterns(symbol = 'ETHUSDT', timeframe = '1h') {
    try {
      const ohlcvData = await marketService.getHistoricalData(symbol, timeframe, 10);

      if (ohlcvData.length < 3) {
        throw new Error('Insufficient data for pattern detection');
      }

      const patterns = [];
      const latestCandle = ohlcvData[ohlcvData.length - 1];

      const doji = this.detectDoji(latestCandle);
      if (doji) patterns.push(doji);

      const hammer = this.detectHammer(latestCandle);
      if (hammer) patterns.push(hammer);

      const shootingStar = this.detectShootingStar(latestCandle);
      if (shootingStar) patterns.push(shootingStar);

      if (ohlcvData.length >= 2) {
        const engulfing = this.detectEngulfing(
          ohlcvData[ohlcvData.length - 2],
          latestCandle
        );
        if (engulfing) patterns.push(engulfing);
      }

      if (ohlcvData.length >= 3) {
        const morningEveningStar = this.detectMorningEveningStar(
          ohlcvData[ohlcvData.length - 3],
          ohlcvData[ohlcvData.length - 2],
          latestCandle
        );
        if (morningEveningStar) patterns.push(morningEveningStar);

        const threeCandlePattern = this.detectThreeCandlePattern(
          ohlcvData[ohlcvData.length - 3],
          ohlcvData[ohlcvData.length - 2],
          latestCandle
        );
        if (threeCandlePattern) patterns.push(threeCandlePattern);
      }

      for (const pattern of patterns) {
        await Pattern.create({
          symbol,
          timeframe,
          timestamp: latestCandle.timestamp,
          ...pattern,
        });
      }

      logger.info(`Detected ${patterns.length} patterns for ${symbol} ${timeframe}`);
      return patterns;
    } catch (error) {
      logger.error(`Failed to detect patterns: ${error.message}`);
      throw error;
    }
  }

  detectDoji(candle) {
    const open = parseFloat(candle.open);
    const close = parseFloat(candle.close);
    const high = parseFloat(candle.high);
    const low = parseFloat(candle.low);

    const bodySize = Math.abs(close - open);
    const totalRange = high - low;

    if (totalRange === 0) return null;

    const bodyRatio = bodySize / totalRange;

    if (bodyRatio < 0.1) {
      return {
        patternType: 'doji',
        signal: 'neutral',
        strength: Math.round((1 - bodyRatio) * 100),
        description: 'Doji candle detected - Market indecision',
      };
    }

    return null;
  }

  detectHammer(candle) {
    const open = parseFloat(candle.open);
    const close = parseFloat(candle.close);
    const high = parseFloat(candle.high);
    const low = parseFloat(candle.low);

    const bodySize = Math.abs(close - open);
    const lowerShadow = Math.min(open, close) - low;
    const upperShadow = high - Math.max(open, close);
    const totalRange = high - low;

    if (totalRange === 0) return null;

    if (lowerShadow > bodySize * 2 && upperShadow < bodySize * 0.5) {
      return {
        patternType: 'hammer',
        signal: 'bullish',
        strength: Math.round((lowerShadow / totalRange) * 100),
        description: 'Hammer pattern - Potential bullish reversal',
      };
    }

    return null;
  }

  detectShootingStar(candle) {
    const open = parseFloat(candle.open);
    const close = parseFloat(candle.close);
    const high = parseFloat(candle.high);
    const low = parseFloat(candle.low);

    const bodySize = Math.abs(close - open);
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;
    const totalRange = high - low;

    if (totalRange === 0) return null;

    if (upperShadow > bodySize * 2 && lowerShadow < bodySize * 0.5) {
      return {
        patternType: 'shooting_star',
        signal: 'bearish',
        strength: Math.round((upperShadow / totalRange) * 100),
        description: 'Shooting star pattern - Potential bearish reversal',
      };
    }

    return null;
  }

  detectEngulfing(prevCandle, currentCandle) {
    const prevOpen = parseFloat(prevCandle.open);
    const prevClose = parseFloat(prevCandle.close);
    const currOpen = parseFloat(currentCandle.open);
    const currClose = parseFloat(currentCandle.close);

    if (currOpen < prevClose && currClose > prevOpen && prevClose < prevOpen) {
      return {
        patternType: 'bullish_engulfing',
        signal: 'bullish',
        strength: 75,
        description: 'Bullish engulfing pattern detected',
      };
    }

    if (currOpen > prevClose && currClose < prevOpen && prevClose > prevOpen) {
      return {
        patternType: 'bearish_engulfing',
        signal: 'bearish',
        strength: 75,
        description: 'Bearish engulfing pattern detected',
      };
    }

    return null;
  }

  detectMorningEveningStar(candle1, candle2, candle3) {
    const c1Close = parseFloat(candle1.close);
    const c1Open = parseFloat(candle1.open);
    const c2Body = Math.abs(parseFloat(candle2.close) - parseFloat(candle2.open));
    const c3Close = parseFloat(candle3.close);
    const c3Open = parseFloat(candle3.open);

    if (c1Close < c1Open && c2Body < Math.abs(c1Close - c1Open) * 0.3 && c3Close > c3Open) {
      return {
        patternType: 'morning_star',
        signal: 'bullish',
        strength: 80,
        description: 'Morning star pattern - Strong bullish reversal',
      };
    }

    if (c1Close > c1Open && c2Body < Math.abs(c1Close - c1Open) * 0.3 && c3Close < c3Open) {
      return {
        patternType: 'evening_star',
        signal: 'bearish',
        strength: 80,
        description: 'Evening star pattern - Strong bearish reversal',
      };
    }

    return null;
  }

  detectThreeCandlePattern(candle1, candle2, candle3) {
    const c1Close = parseFloat(candle1.close);
    const c1Open = parseFloat(candle1.open);
    const c2Close = parseFloat(candle2.close);
    const c2Open = parseFloat(candle2.open);
    const c3Close = parseFloat(candle3.close);
    const c3Open = parseFloat(candle3.open);

    if (
      c1Close > c1Open &&
      c2Close > c2Open &&
      c3Close > c3Open &&
      c2Open > c1Close &&
      c3Open > c2Close
    ) {
      return {
        patternType: 'three_white_soldiers',
        signal: 'bullish',
        strength: 85,
        description: 'Three white soldiers - Strong bullish continuation',
      };
    }

    if (
      c1Close < c1Open &&
      c2Close < c2Open &&
      c3Close < c3Open &&
      c2Open < c1Close &&
      c3Open < c2Close
    ) {
      return {
        patternType: 'three_black_crows',
        signal: 'bearish',
        strength: 85,
        description: 'Three black crows - Strong bearish continuation',
      };
    }

    return null;
  }

  async getRecentPatterns(symbol = 'ETHUSDT', timeframe = '1h', limit = 10) {
    return await Pattern.findAll({
      where: { symbol, timeframe },
      order: [['timestamp', 'DESC']],
      limit,
    });
  }
}

module.exports = new PatternService();
