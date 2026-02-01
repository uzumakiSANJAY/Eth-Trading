import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm';
import { Timeframe } from './ohlcv.entity';

@Entity('indicators')
@Index(['symbol', 'timeframe', 'timestamp'])
export class IndicatorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'enum', enum: Timeframe })
  timeframe: Timeframe;

  @Column({ type: 'bigint' })
  timestamp: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  rsi: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  macd: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  macdSignal: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  macdHistogram: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  ema9: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  ema21: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  ema50: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  ema200: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  vwap: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  atr: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  bollingerUpper: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  bollingerMiddle: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  bollingerLower: number;

  @CreateDateColumn()
  createdAt: Date;
}
