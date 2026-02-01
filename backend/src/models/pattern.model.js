const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/config/database');

const Pattern = sequelize.define('Pattern', {
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
  patternType: {
    type: DataTypes.ENUM(
      'doji',
      'hammer',
      'inverted_hammer',
      'shooting_star',
      'bullish_engulfing',
      'bearish_engulfing',
      'morning_star',
      'evening_star',
      'three_white_soldiers',
      'three_black_crows'
    ),
    allowNull: false,
  },
  signal: {
    type: DataTypes.ENUM('bullish', 'bearish', 'neutral'),
    allowNull: false,
  },
  strength: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 100,
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'patterns',
  indexes: [
    {
      fields: ['symbol', 'timeframe', 'timestamp'],
    },
  ],
  timestamps: true,
  updatedAt: false,
});

module.exports = Pattern;
