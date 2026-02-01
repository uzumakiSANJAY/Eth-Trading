import { Controller, Get, Query } from '@nestjs/common';
import { MarketService } from './market.service';
import { Timeframe } from '../../entities/ohlcv.entity';

@Controller('api/market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('price')
  async getCurrentPrice(@Query('symbol') symbol: string = 'ETH/USDT') {
    const price = await this.marketService.getCurrentPrice(symbol);
    return {
      symbol,
      price,
      timestamp: Date.now(),
    };
  }

  @Get('ohlcv')
  async getOhlcvData(
    @Query('symbol') symbol: string = 'ETHUSDT',
    @Query('timeframe') timeframe: Timeframe = Timeframe.ONE_HOUR,
    @Query('limit') limit: number = 100,
  ) {
    const data = await this.marketService.getHistoricalData(
      symbol,
      timeframe,
      limit,
    );
    return {
      symbol,
      timeframe,
      count: data.length,
      data,
    };
  }

  @Get('volume')
  async getVolumeAnalysis(
    @Query('symbol') symbol: string = 'ETHUSDT',
    @Query('timeframe') timeframe: Timeframe = Timeframe.ONE_HOUR,
    @Query('candles') candles: number = 24,
  ) {
    const volumeData = await this.marketService.getRecentVolume(
      symbol,
      timeframe,
      candles,
    );
    return {
      symbol,
      timeframe,
      ...volumeData,
      analysis:
        volumeData.volumeRatio > 1.5
          ? 'High volume spike detected'
          : volumeData.volumeRatio < 0.5
          ? 'Low volume detected'
          : 'Normal volume',
    };
  }

  @Get('fetch')
  async fetchFreshData(
    @Query('symbol') symbol: string = 'ETH/USDT',
    @Query('timeframe') timeframe: Timeframe = Timeframe.ONE_HOUR,
    @Query('limit') limit: number = 500,
  ) {
    await this.marketService.fetchAndStoreOhlcv(symbol, timeframe, limit);
    return {
      message: 'Data fetched and stored successfully',
      symbol,
      timeframe,
      limit,
    };
  }
}
