const Redis = require('ioredis');
const { promisify } = require('util');
const { MPESAError } = require('../utils/errors');
const logger = require('../utils/logger');

class TokenManager {
  constructor(config) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      keyPrefix: 'rada:',
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.config = config;
    this.TOKEN_KEY = 'mpesa:access_token';
    this.TOKEN_EXPIRY = 3300; // 55 minutes (token expires in 1 hour)
  }

  async getValidToken() {
    try {
      // Try to get cached token
      let token = await this.redis.get(this.TOKEN_KEY);
      
      if (!token) {
        logger.info('Token not found in cache, fetching new token');
        token = await this.fetchNewToken();
        
        // Cache the new token
        await this.redis.setex(this.TOKEN_KEY, this.TOKEN_EXPIRY, token);
      }
      
      return token;
    } catch (error) {
      logger.error('Failed to get valid token', { error: error.message });
      throw new MPESAError('Authentication failed', error);
    }
  }

  async fetchNewToken() {
    try {
      const auth = Buffer.from(
        `${this.config.consumerKey}:${this.config.consumerSecret}`
      ).toString('base64');

      const response = await axios.get(
        `${this.config.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: { Authorization: `Basic ${auth}` },
          timeout: 5000
        }
      );

      logger.info('Successfully fetched new token');
      return response.data.access_token;
    } catch (error) {
      logger.error('Failed to fetch new token', { error: error.message });
      throw new MPESAError('Failed to fetch access token', error);
    }
  }

  async invalidateToken() {
    try {
      await this.redis.del(this.TOKEN_KEY);
      logger.info('Token invalidated successfully');
    } catch (error) {
      logger.error('Failed to invalidate token', { error: error.message });
    }
  }

  async healthCheck() {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed', { error: error.message });
      return false;
    }
  }
}

module.exports = TokenManager;
