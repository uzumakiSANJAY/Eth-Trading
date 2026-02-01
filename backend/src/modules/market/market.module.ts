import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { OhlcvEntity } from '../../entities/ohlcv.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OhlcvEntity]), ConfigModule],
  controllers: [MarketController],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}
