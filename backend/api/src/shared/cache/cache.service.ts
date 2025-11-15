import { createHash } from 'crypto';
import { redis } from './redis.client.js';
import { logger } from '../logger/winston.config.js';

/**
 * Cache Service
 *
 * Provides a unified caching interface with support for:
 * - In-memory caching (for small, frequently accessed data)
 * - Redis caching (for larger datasets and distributed caching)
 * - Cache invalidation patterns
 * - Cache key generation
 */
export class CacheService {
  // Tier 1: In-memory cache
  private memoryCache = new Map<string, { data: any; expiresAt: number }>();
  private readonly MAX_MEMORY_CACHE_SIZE = 100_000; // 100KB per item

  /**
   * Get value from cache
   * Checks memory cache first, then Redis
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Check memory cache
      const memCached = this.memoryCache.get(key);
      if (memCached && memCached.expiresAt > Date.now()) {
        logger.debug('Cache hit (memory)', { key });
        return memCached.data as T;
      }

      // Check Redis
      const redisCached = await redis.get(key);
      if (redisCached) {
        logger.debug('Cache hit (Redis)', { key });
        const parsed = JSON.parse(redisCached) as T;

        // Store in memory cache if small enough
        const dataSize = redisCached.length;
        if (dataSize < this.MAX_MEMORY_CACHE_SIZE) {
          this.memoryCache.set(key, {
            data: parsed,
            expiresAt: Date.now() + 300_000, // 5 minutes
          });
        }

        return parsed;
      }

      logger.debug('Cache miss', { key });
      return null;
    } catch (error) {
      logger.error('Cache get error', { key, error });
      return null;
    }
  }

  /**
   * Set value in cache
   * Stores in both memory and Redis based on size
   */
  async set(key: string, data: any, ttlSeconds: number): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      const dataSize = serialized.length;

      // Store in memory cache if small enough
      if (dataSize < this.MAX_MEMORY_CACHE_SIZE) {
        this.memoryCache.set(key, {
          data,
          expiresAt: Date.now() + ttlSeconds * 1000,
        });
      }

      // Always store in Redis
      await redis.setex(key, ttlSeconds, serialized);

      logger.debug('Cache set', { key, ttlSeconds, size: dataSize });
    } catch (error) {
      logger.error('Cache set error', { key, error });
    }
  }

  /**
   * Delete specific key from cache
   */
  async delete(key: string): Promise<void> {
    try {
      this.memoryCache.delete(key);
      await redis.del(key);
      logger.debug('Cache delete', { key });
    } catch (error) {
      logger.error('Cache delete error', { key, error });
    }
  }

  /**
   * Alias for delete() - for convenience
   */
  async del(key: string): Promise<void> {
    return this.delete(key);
  }

  /**
   * Invalidate cache by pattern
   * Supports wildcards (e.g., "products:*")
   */
  async invalidate(pattern: string): Promise<void> {
    try {
      // Clear memory cache
      const regex = new RegExp(pattern.replace('*', '.*'));
      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
        }
      }

      // Clear Redis cache
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      logger.info('Cache invalidated', { pattern, keysDeleted: keys.length });
    } catch (error) {
      logger.error('Cache invalidate error', { pattern, error });
    }
  }

  /**
   * Alias for invalidate() - for convenience
   */
  async invalidatePattern(pattern: string): Promise<void> {
    return this.invalidate(pattern);
  }

  /**
   * Generate cache key from prefix and params
   */
  generateKey(prefix: string, params: Record<string, any>): string {
    const hash = createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex');
    return `${prefix}:${hash}`;
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    try {
      this.memoryCache.clear();
      await redis.flushdb();
      logger.info('All caches cleared');
    } catch (error) {
      logger.error('Cache clear error', { error });
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      memoryCache: {
        size: this.memoryCache.size,
        keys: Array.from(this.memoryCache.keys()),
      },
    };
  }
}

// Export singleton instance
export const cacheService = new CacheService();
