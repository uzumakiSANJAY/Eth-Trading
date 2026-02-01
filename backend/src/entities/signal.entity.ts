import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm';
import { Timeframe } from './ohlcv.entity';

export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD',
}

export enum SignalStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
  EXPIRED = 'expired',
}

@Entity('signals')
@Index(['symbol', 'timeframe', 'createdAt'])
export class SignalEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'enum', enum: Timeframe })
  timeframe: Timeframe;

  @Column({ type: 'enum', enum: SignalType })
  signalType: SignalType;

  @Column({ type: 'enum', enum: SignalStatus, default: SignalStatus.ACTIVE })
  status: SignalStatus;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  confidence: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  entryPrice: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  entryZoneMin: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  entryZoneMax: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  stopLoss: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  takeProfit1: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  takeProfit2: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  takeProfit3: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  riskRewardRatio: number;

  @Column({ type: 'jsonb', nullable: true })
  reasoning: {
    indicators: Record<string, any>;
    patterns: string[];
    mlPrediction: {
      probability: number;
      direction: string;
    };
    volumeAnalysis: string;
  };

  @Column({ type: 'bigint' })
  timestamp: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  exitPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  profitLossPercent: number;
}
