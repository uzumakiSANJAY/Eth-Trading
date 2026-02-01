const { createClient } = require('redis');
const logger = require('../../utils/logger');

let redisClient = null;

async function initRedis() {
  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  });

  redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
  redisClient.on('connect', () => logger.info('Redis Client Connected'));
  redisClient.on('ready', () => logger.info('Redis Client Ready'));

  await redisClient.connect();
  return redisClient;
}

function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initRedis() first.');
  }
  return redisClient;
}

async function setCache(key, value, expirySeconds = 300) {
  try {
    const client = getRedisClient();
    await client.setEx(key, expirySeconds, JSON.stringify(value));
  } catch (error) {
    logger.error('Redis SET error:', error);
  }
}

async function getCache(key) {
  try {
    const client = getRedisClient();
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Redis GET error:', error);
    return null;
  }
}

async function deleteCache(key) {
  try {
    const client = getRedisClient();
    await client.del(key);
  } catch (error) {
    logger.error('Redis DEL error:', error);
  }
}

module.exports = {
  initRedis,
  getRedisClient,
  setCache,
  getCache,
  deleteCache,
};
