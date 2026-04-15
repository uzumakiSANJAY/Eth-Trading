const { Sequelize } = require('sequelize');
const logger = require('../../utils/logger');

if (!process.env.DATABASE_URL) {
  logger.error('FATAL: DATABASE_URL environment variable is not set. Exiting.');
  process.exit(1);
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: (msg) => logger.debug(msg),
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: process.env.NODE_ENV === 'production' ? {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  } : {},
});

module.exports = { sequelize };
