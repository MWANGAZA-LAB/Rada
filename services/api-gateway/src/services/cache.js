const Redis = require('ioredis');
const logger = require('../utils/logger');

class RedisCache {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || null,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    this.redis.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} - Cached value or null
   */
  async get(key) {
    try {
      const value = await this.redis.get(key);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      logger.error('Redis get error:', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (default: 3600)
   * @returns {Promise<boolean>} - Success status
   */
  async set(key, value, ttl = 3600) {
    try {
      const serializedValue = JSON.stringify(value);
      if (ttl > 0) {
        await this.redis.setex(key, ttl, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }
      return true;
    } catch (error) {
      logger.error('Redis set error:', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - Success status
   */
  async del(key) {
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Redis del error:', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete multiple keys from cache
   * @param {string[]} keys - Array of cache keys
   * @returns {Promise<number>} - Number of deleted keys
   */
  async delMultiple(keys) {
    try {
      if (keys.length === 0) return 0;
      const result = await this.redis.del(...keys);
      return result;
    } catch (error) {
      logger.error('Redis delMultiple error:', { keys, error: error.message });
      return 0;
    }
  }

  /**
   * Invalidate keys by pattern
   * @param {string} pattern - Redis pattern (e.g., 'user:*')
   * @returns {Promise<number>} - Number of invalidated keys
   */
  async invalidate(pattern) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        const result = await this.redis.del(...keys);
        logger.info('Cache invalidation completed:', { pattern, keysCount: keys.length, deletedCount: result });
        return result;
      }
      return 0;
    } catch (error) {
      logger.error('Redis invalidate error:', { pattern, error: error.message });
      return 0;
    }
  }

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - Existence status
   */
  async exists(key) {
    try {
      const result = await this.redis.exists(key);
      return result > 0;
    } catch (error) {
      logger.error('Redis exists error:', { key, error: error.message });
      return false;
    }
  }

  /**
   * Get TTL for key
   * @param {string} key - Cache key
   * @returns {Promise<number>} - TTL in seconds (-1 if no expiry, -2 if key doesn't exist)
   */
  async ttl(key) {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      logger.error('Redis ttl error:', { key, error: error.message });
      return -2;
    }
  }

  /**
   * Increment counter
   * @param {string} key - Cache key
   * @param {number} increment - Increment value (default: 1)
   * @returns {Promise<number>} - New value
   */
  async incr(key, increment = 1) {
    try {
      if (increment === 1) {
        return await this.redis.incr(key);
      } else {
        return await this.redis.incrby(key, increment);
      }
    } catch (error) {
      logger.error('Redis incr error:', { key, increment, error: error.message });
      return 0;
    }
  }

  /**
   * Set hash field
   * @param {string} key - Hash key
   * @param {string} field - Field name
   * @param {any} value - Field value
   * @returns {Promise<boolean>} - Success status
   */
  async hset(key, field, value) {
    try {
      const serializedValue = JSON.stringify(value);
      await this.redis.hset(key, field, serializedValue);
      return true;
    } catch (error) {
      logger.error('Redis hset error:', { key, field, error: error.message });
      return false;
    }
  }

  /**
   * Get hash field
   * @param {string} key - Hash key
   * @param {string} field - Field name
   * @returns {Promise<any>} - Field value or null
   */
  async hget(key, field) {
    try {
      const value = await this.redis.hget(key, field);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      logger.error('Redis hget error:', { key, field, error: error.message });
      return null;
    }
  }

  /**
   * Get all hash fields
   * @param {string} key - Hash key
   * @returns {Promise<object>} - Hash object
   */
  async hgetall(key) {
    try {
      const hash = await this.redis.hgetall(key);
      const result = {};
      for (const [field, value] of Object.entries(hash)) {
        try {
          result[field] = JSON.parse(value);
        } catch {
          result[field] = value;
        }
      }
      return result;
    } catch (error) {
      logger.error('Redis hgetall error:', { key, error: error.message });
      return {};
    }
  }

  /**
   * Cache wrapper with automatic serialization
   * @param {string} key - Cache key
   * @param {Function} fetchFunction - Function to fetch data if not cached
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<any>} - Cached or fresh data
   */
  async getOrSet(key, fetchFunction, ttl = 3600) {
    try {
      // Try to get from cache first
      const cached = await this.get(key);
      if (cached !== null) {
        logger.debug('Cache hit:', { key });
        return cached;
      }

      // Fetch fresh data
      logger.debug('Cache miss, fetching fresh data:', { key });
      const fresh = await fetchFunction();
      
      // Cache the result
      if (fresh !== null && fresh !== undefined) {
        await this.set(key, fresh, ttl);
      }

      return fresh;
    } catch (error) {
      logger.error('Cache getOrSet error:', { key, error: error.message });
      // Fallback to fresh data
      try {
        return await fetchFunction();
      } catch (fetchError) {
        logger.error('Fetch function error:', { key, error: fetchError.message });
        throw fetchError;
      }
    }
  }

  /**
   * Health check
   * @returns {Promise<boolean>} - Redis health status
   */
  async healthCheck() {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    try {
      await this.redis.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }
  }
}

// Create singleton instance
const cache = new RedisCache();

module.exports = cache;
