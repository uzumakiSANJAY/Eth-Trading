const ccxt = require('ccxt');
const { Ohlcv } = require('../models');
const logger = require('../utils/logger');
const { setCache, getCache } = require('../database/config/redis');

class MarketService {
  constructor() {
    this.exchange = new ccxt.binance({
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_API_SECRET,
      enableRateLimit: true,
    });
  }

  async getCurrentPrice(symbol = 'ETH/USDT') {
    const cacheKey = `price:${symbol}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    try {
      const ticker = await this.exchange.fetchTicker(symbol);
      const price = ticker.last;
      await setCache(cacheKey, price, 10);
      return price;
    } catch (error) {
      logger.error(`Failed to fetch current price: ${error.message}`);
      throw error;
    }
  }

  async fetchAndStoreOhlcv(symbol = 'ETH/USDT', timeframe = '1h', limit = 500) {
    try {
      const ohlcvData = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
      const symbolFormatted = symbol.replace('/', '');

      const records = ohlcvData.map((candle) => ({
        symbol: symbolFormatted,
        timeframe,
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
      }));

      for (const record of records) {
        await Ohlcv.upsert(record, {
          conflictFields: ['symbol', 'timeframe', 'timestamp'],
        });
      }

      logger.info(`Stored ${records.length} ${timeframe} candles for ${symbol}`);
      return records;
    } catch (error) {
      logger.error(`Failed to fetch OHLCV data: ${error.message}`);
      throw error;
    }
  }

  async getHistoricalData(symbol = 'ETHUSDT', timeframe = '1h', limit = 100) {
    const cacheKey = `ohlcv:${symbol}:${timeframe}:${limit}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const data = await Ohlcv.findAll({
      where: { symbol, timeframe },
      order: [['timestamp', 'DESC']],
      limit,
    });

    const result = data.reverse();
    await setCache(cacheKey, result, 60);
    return result;
  }

  async getLatestCandle(symbol = 'ETHUSDT', timeframe = '1h') {
    return await Ohlcv.findOne({
      where: { symbol, timeframe },
      order: [['timestamp', 'DESC']],
    });
  }

  async getVolumeAnalysis(symbol = 'ETHUSDT', timeframe = '1h', candles = 24) {
    const data = await this.getHistoricalData(symbol, timeframe, candles + 1);

    if (data.length < 2) {
      return { avgVolume: 0, currentVolume: 0, volumeRatio: 0 };
    }

    const volumes = data.map((d) => parseFloat(d.volume));
    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;

    return { avgVolume, currentVolume, volumeRatio };
  }
}

module.exports = new MarketService();
