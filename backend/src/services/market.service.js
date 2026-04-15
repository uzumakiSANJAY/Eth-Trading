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
      options: {
        recvWindow: 5000,
      },
    });
    this._timeSynced = false;
    this._lastSyncTime = 0;
  }

  async _ensureTimeSync() {
    const now = Date.now();
    // Sync on first call and every 30 minutes
    if (!this._timeSynced || now - this._lastSyncTime > 30 * 60 * 1000) {
      try {
        const serverTime = await this.exchange.fetchTime();
        this.exchange.options.timeDifference = now - serverTime;
        this._timeSynced = true;
        this._lastSyncTime = now;
        logger.info(`Binance time synced, offset: ${this.exchange.options.timeDifference}ms`);
      } catch (error) {
        logger.error(`Failed to sync Binance time: ${error.message}`);
      }
    }
  }

  async getCurrentPrice(symbol = 'ETH/USDT') {
    const cacheKey = `price:${symbol}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    await this._ensureTimeSync();
    try {
      const ticker = await this.exchange.fetchTicker(symbol);
      const price = ticker.last;
      // TTL 4s — shorter than WebSocket interval (5s) so every broadcast gets a fresh price
      await setCache(cacheKey, price, 4);
      return price;
    } catch (error) {
      logger.error(`Failed to fetch current price: ${error.message}`);
      throw error;
    }
  }

  async fetchAndStoreOhlcv(symbol = 'ETH/USDT', timeframe = '1h', limit = 500) {
    await this._ensureTimeSync();
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

      // Bulk upsert — one query instead of 500 sequential round trips
      await Ohlcv.bulkCreate(records, {
        updateOnDuplicate: ['open', 'high', 'low', 'close', 'volume'],
        conflictAttributes: ['symbol', 'timeframe', 'timestamp'],
      });

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

  async get24hStats(symbol = 'ETHUSDT') {
    // Use Binance's live 24h ticker — accurate even if local DB has gaps
    const formattedSymbol = symbol.includes('/') ? symbol : `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
    try {
      await this._ensureTimeSync();
      const ticker = await this.exchange.fetchTicker(formattedSymbol);
      return {
        high: ticker.high,
        low: ticker.low,
        open: ticker.open,
        close: ticker.close,
        volume: ticker.baseVolume,
        quoteVolume: ticker.quoteVolume,
        change: ticker.change,
        changePercent: ticker.percentage,
      };
    } catch (err) {
      logger.warn(`Live 24h stats failed, falling back to DB: ${err.message}`);
      const data = await Ohlcv.findAll({
        where: { symbol, timeframe: '1h' },
        order: [['timestamp', 'DESC']],
        limit: 24,
      });
      if (data.length === 0) return null;
      let highCandle = data[0];
      let lowCandle = data[0];
      for (const candle of data) {
        if (parseFloat(candle.high) > parseFloat(highCandle.high)) highCandle = candle;
        if (parseFloat(candle.low) < parseFloat(lowCandle.low)) lowCandle = candle;
      }
      return {
        high: parseFloat(highCandle.high),
        highTime: highCandle.timestamp,
        low: parseFloat(lowCandle.low),
        lowTime: lowCandle.timestamp,
      };
    }
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
