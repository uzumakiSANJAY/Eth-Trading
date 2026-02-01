const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/config/database');

const Indicator = sequelize.define('Indicator', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  symbol: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  timeframe: {
    type: DataTypes.ENUM('1m', '5m', '15m', '30m', '1h', '4h', '1d'),
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  rsi: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  macd: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  macdSignal: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  macdHistogram: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  ema9: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  ema21: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  ema50: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  ema200: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  vwap: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  atr: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  bollingerUpper: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  bollingerMiddle: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  bollingerLower: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
}, {
  tableName: 'indicators',
  indexes: [
    {
      fields: ['symbol', 'timeframe', 'timestamp'],
    },
  ],
  timestamps: true,
  updatedAt: false,
});

module.exports = Indicator;
