import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm';
import { Timeframe } from './ohlcv.entity';

export enum PatternType {
  DOJI = 'doji',
  HAMMER = 'hammer',
  INVERTED_HAMMER = 'inverted_hammer',
  SHOOTING_STAR = 'shooting_star',
  BULLISH_ENGULFING = 'bullish_engulfing',
  BEARISH_ENGULFING = 'bearish_engulfing',
  MORNING_STAR = 'morning_star',
  EVENING_STAR = 'evening_star',
  THREE_WHITE_SOLDIERS = 'three_white_soldiers',
  THREE_BLACK_CROWS = 'three_black_crows',
}

export enum PatternSignal {
  BULLISH = 'bullish',
  BEARISH = 'bearish',
  NEUTRAL = 'neutral',
}

@Entity('patterns')
@Index(['symbol', 'timeframe', 'timestamp'])
export class PatternEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  symbol: string;

  @Column({ type: 'enum', enum: Timeframe })
  timeframe: Timeframe;

  @Column({ type: 'bigint' })
  timestamp: number;

  @Column({ type: 'enum', enum: PatternType })
  patternType: PatternType;

  @Column({ type: 'enum', enum: PatternSignal })
  signal: PatternSignal;

  @Column({ type: 'int' })
  strength: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}
