import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm';

export enum Timeframe {
  ONE_MINUTE = '1m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  THIRTY_MINUTES = '30m',
  ONE_HOUR = '1h',
  FOUR_HOURS = '4h',
  ONE_DAY = '1d',
}

@Entity('ohlcv_data')
@Index(['symbol', 'timeframe', 'timestamp'], { unique: true })
export class OhlcvEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'enum', enum: Timeframe })
  timeframe: Timeframe;

  @Column({ type: 'bigint' })
  timestamp: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  open: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  high: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  low: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  close: number;

  @Column({ type: 'decimal', precision: 18, scale: 4 })
  volume: number;

  @CreateDateColumn()
  createdAt: Date;
}
