import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { getDatabaseConfig } from './config/database.config';
import { MarketModule } from './modules/market/market.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { PatternsModule } from './modules/patterns/patterns.module';
import { SignalsModule } from './modules/signals/signals.module';
import { WebsocketModule } from './modules/websocket/websocket.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    ScheduleModule.forRoot(),
    MarketModule,
    AnalysisModule,
    PatternsModule,
    SignalsModule,
    WebsocketModule,
  ],
})
export class AppModule {}
