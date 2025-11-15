import Redis from 'ioredis';
import { redisConfig } from '../../config/redis.config.js';
import { logger } from '../logger/winston.config.js';

/**
 * Redis client singleton
 */
class RedisClient {
  private static instance: Redis | null = null;

  static getInstance(): Redis {
    if (!RedisClient.instance) {
      RedisClient.instance = new Redis(redisConfig);

      RedisClient.instance.on('connect', () => {
        logger.info('✅ Redis connected');
      });

      RedisClient.instance.on('error', (error) => {
        logger.error('❌ Redis error:', { error });
      });

      RedisClient.instance.on('close', () => {
        logger.warn('⚠️  Redis connection closed');
      });
    }

    return RedisClient.instance;
  }

  static async disconnect(): Promise<void> {
    if (RedisClient.instance) {
      await RedisClient.instance.quit();
      RedisClient.instance = null;
      logger.info('Redis disconnected');
    }
  }
}

export const redis = RedisClient.getInstance();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await RedisClient.disconnect();
});

process.on('SIGINT', async () => {
  await RedisClient.disconnect();
});
