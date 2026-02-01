import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

export type RedisClient = ReturnType<typeof createClient>;

export const getRedisClient = async (
  configService: ConfigService,
): Promise<RedisClient> => {
  const client = createClient({
    url: configService.get<string>('REDIS_URL'),
  });

  client.on('error', (err) => console.error('Redis Client Error', err));
  client.on('connect', () => console.log('Redis Client Connected'));

  await client.connect();
  return client;
};
