const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/config/database');

const Ohlcv = sequelize.define('Ohlcv', {
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
  open: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false,
  },
  high: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false,
  },
  low: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false,
  },
  close: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false,
  },
  volume: {
    type: DataTypes.DECIMAL(18, 4),
    allowNull: false,
  },
}, {
  tableName: 'ohlcv_data',
  indexes: [
    {
      unique: true,
      fields: ['symbol', 'timeframe', 'timestamp'],
    },
    {
      fields: ['symbol', 'timeframe'],
    },
  ],
  timestamps: true,
  updatedAt: false,
});

module.exports = Ohlcv;
