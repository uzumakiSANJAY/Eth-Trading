const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/config/database');

const Signal = sequelize.define('Signal', {
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
  signalType: {
    type: DataTypes.ENUM('BUY', 'SELL', 'HOLD'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('active', 'closed', 'expired'),
    defaultValue: 'active',
  },
  confidence: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    validate: {
      min: 0,
      max: 100,
    },
  },
  entryPrice: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false,
  },
  entryZoneMin: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  entryZoneMax: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  stopLoss: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  takeProfit1: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  takeProfit2: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  takeProfit3: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  riskRewardRatio: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  },
  reasoning: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  timestamp: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  exitPrice: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  profitLossPercent: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
}, {
  tableName: 'signals',
  indexes: [
    {
      fields: ['symbol', 'timeframe', 'createdAt'],
    },
    {
      fields: ['status'],
    },
  ],
  timestamps: true,
  updatedAt: true,
});

module.exports = Signal;
