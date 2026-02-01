import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as ccxt from 'ccxt';
import { OhlcvEntity, Timeframe } from '../../entities/ohlcv.entity';

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);
  private exchange: ccxt.binance;

  constructor(
    @InjectRepository(OhlcvEntity)
    private ohlcvRepository: Repository<OhlcvEntity>,
  ) {
    this.exchange = new ccxt.binance({
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_API_SECRET,
      enableRateLimit: true,
    });
  }

  async getCurrentPrice(symbol: string = 'ETH/USDT'): Promise<number> {
    try {
      const ticker = await this.exchange.fetchTicker(symbol);
      return ticker.last;
    } catch (error) {
      this.logger.error(`Failed to fetch current price: ${error.message}`);
      throw error;
    }
  }

  async fetchAndStoreOhlcv(
    symbol: string = 'ETH/USDT',
    timeframe: Timeframe = Timeframe.ONE_HOUR,
    limit: number = 500,
  ): Promise<OhlcvEntity[]> {
    try {
      const ohlcvData = await this.exchange.fetchOHLCV(
        symbol,
        timeframe,
        undefined,
        limit,
      );

      const entities = ohlcvData.map((candle) => {
        const entity = new OhlcvEntity();
        entity.symbol = symbol.replace('/', '');
        entity.timeframe = timeframe;
        entity.timestamp = candle[0];
        entity.open = candle[1];
        entity.high = candle[2];
        entity.low = candle[3];
        entity.close = candle[4];
        entity.volume = candle[5];
        return entity;
      });

      await this.ohlcvRepository.upsert(entities, {
        conflictPaths: ['symbol', 'timeframe', 'timestamp'],
        skipUpdateIfNoValuesChanged: true,
      });

      this.logger.log(
        `Stored ${entities.length} ${timeframe} candles for ${symbol}`,
      );
      return entities;
    } catch (error) {
      this.logger.error(
        `Failed to fetch OHLCV data: ${error.message}`,
      );
      throw error;
    }
  }

  async getHistoricalData(
    symbol: string = 'ETHUSDT',
    timeframe: Timeframe = Timeframe.ONE_HOUR,
    limit: number = 100,
  ): Promise<OhlcvEntity[]> {
    const data = await this.ohlcvRepository.find({
      where: { symbol, timeframe },
      order: { timestamp: 'DESC' },
      take: limit,
    });

    return data.reverse();
  }

  async getLatestCandle(
    symbol: string = 'ETHUSDT',
    timeframe: Timeframe = Timeframe.ONE_HOUR,
  ): Promise<OhlcvEntity> {
    return await this.ohlcvRepository.findOne({
      where: { symbol, timeframe },
      order: { timestamp: 'DESC' },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async updateOneMinuteData() {
    await this.fetchAndStoreOhlcv('ETH/USDT', Timeframe.ONE_MINUTE, 100);
  }

  @Cron('0 */5 * * * *')
  async updateFiveMinuteData() {
    await this.fetchAndStoreOhlcv('ETH/USDT', Timeframe.FIVE_MINUTES, 100);
  }

  @Cron('0 */15 * * * *')
  async updateFifteenMinuteData() {
    await this.fetchAndStoreOhlcv('ETH/USDT', Timeframe.FIFTEEN_MINUTES, 100);
  }

  @Cron('0 0 * * * *')
  async updateOneHourData() {
    await this.fetchAndStoreOhlcv('ETH/USDT', Timeframe.ONE_HOUR, 100);
  }

  @Cron('0 0 */4 * * *')
  async updateFourHourData() {
    await this.fetchAndStoreOhlcv('ETH/USDT', Timeframe.FOUR_HOURS, 100);
  }

  @Cron('0 0 0 * * *')
  async updateOneDayData() {
    await this.fetchAndStoreOhlcv('ETH/USDT', Timeframe.ONE_DAY, 100);
  }

  async getRecentVolume(
    symbol: string = 'ETHUSDT',
    timeframe: Timeframe = Timeframe.ONE_HOUR,
    candles: number = 24,
  ): Promise<{ avgVolume: number; currentVolume: number; volumeRatio: number }> {
    const data = await this.getHistoricalData(symbol, timeframe, candles + 1);

    if (data.length < 2) {
      return { avgVolume: 0, currentVolume: 0, volumeRatio: 0 };
    }

    const volumes = data.map(d => Number(d.volume));
    const currentVolume = volumes[volumes.length - 1];
    const avgVolume = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 0;

    return { avgVolume, currentVolume, volumeRatio };
  }
}
