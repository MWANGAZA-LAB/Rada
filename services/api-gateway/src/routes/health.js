const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const cache = require('../services/cache');
const logger = require('../utils/logger');

/**
 * Health check endpoint
 * Returns system status including database and Redis connectivity
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();
  const checks = {
    database: false,
    redis: false,
    timestamp: new Date().toISOString()
  };

  let pool;

  try {
    // Database health check
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    const dbStart = Date.now();
    await pool.query('SELECT 1 as health_check');
    const dbDuration = Date.now() - dbStart;
    
    checks.database = true;
    checks.databaseResponseTime = dbDuration;

    logger.info('Database health check passed', { duration: dbDuration });
  } catch (error) {
    logger.error('Database health check failed:', error);
    checks.databaseError = error.message;
  } finally {
    if (pool) {
      await pool.end();
    }
  }

  try {
    // Redis health check
    const redisStart = Date.now();
    await cache.healthCheck();
    const redisDuration = Date.now() - redisStart;
    
    checks.redis = true;
    checks.redisResponseTime = redisDuration;

    logger.info('Redis health check passed', { duration: redisDuration });
  } catch (error) {
    logger.error('Redis health check failed:', error);
    checks.redisError = error.message;
  }

  const totalDuration = Date.now() - startTime;
  checks.totalResponseTime = totalDuration;

  const isHealthy = checks.database && checks.redis;
  const statusCode = isHealthy ? 200 : 503;

  const response = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    checks,
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    }
  };

  res.status(statusCode).json(response);
});

/**
 * Detailed health check endpoint
 * Returns more detailed system information
 */
router.get('/detailed', async (req, res) => {
  const startTime = Date.now();
  const detailedChecks = {
    database: {
      status: false,
      responseTime: null,
      error: null,
      details: {}
    },
    redis: {
      status: false,
      responseTime: null,
      error: null,
      details: {}
    },
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version,
      pid: process.pid
    }
  };

  let pool;

  try {
    // Detailed database check
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    const dbStart = Date.now();
    
    // Check basic connectivity
    await pool.query('SELECT 1 as health_check');
    
    // Check table counts
    const tableCounts = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes
      FROM pg_stat_user_tables 
      WHERE schemaname = 'public'
    `);
    
    const dbDuration = Date.now() - dbStart;
    
    detailedChecks.database.status = true;
    detailedChecks.database.responseTime = dbDuration;
    detailedChecks.database.details = {
      tableCounts: tableCounts.rows,
      connectionPool: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingConnections: pool.waitingCount
    };

    logger.info('Detailed database health check passed', { duration: dbDuration });
  } catch (error) {
    logger.error('Detailed database health check failed:', error);
    detailedChecks.database.error = error.message;
  } finally {
    if (pool) {
      await pool.end();
    }
  }

  try {
    // Detailed Redis check
    const redisStart = Date.now();
    
    // Check basic connectivity
    await cache.healthCheck();
    
    // Get Redis info
    const redisInfo = await cache.redis.info();
    const redisDuration = Date.now() - redisStart;
    
    detailedChecks.redis.status = true;
    detailedChecks.redis.responseTime = redisDuration;
    detailedChecks.redis.details = {
      info: redisInfo,
      memory: await cache.redis.memory('USAGE'),
      keyspace: await cache.redis.info('keyspace')
    };

    logger.info('Detailed Redis health check passed', { duration: redisDuration });
  } catch (error) {
    logger.error('Detailed Redis health check failed:', error);
    detailedChecks.redis.error = error.message;
  }

  const totalDuration = Date.now() - startTime;
  const isHealthy = detailedChecks.database.status && detailedChecks.redis.status;
  const statusCode = isHealthy ? 200 : 503;

  const response = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    checks: detailedChecks,
    totalResponseTime: totalDuration,
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  };

  res.status(statusCode).json(response);
});

/**
 * Readiness probe endpoint
 * Used by Kubernetes to check if the service is ready to receive traffic
 */
router.get('/ready', async (req, res) => {
  const checks = {
    database: false,
    redis: false
  };

  let pool;

  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    await pool.query('SELECT 1');
    checks.database = true;
  } catch (error) {
    logger.error('Readiness check - Database failed:', error);
  } finally {
    if (pool) {
      await pool.end();
    }
  }

  try {
    await cache.healthCheck();
    checks.redis = true;
  } catch (error) {
    logger.error('Readiness check - Redis failed:', error);
  }

  const isReady = checks.database && checks.redis;
  const statusCode = isReady ? 200 : 503;

  res.status(statusCode).json({
    ready: isReady,
    checks,
    timestamp: new Date().toISOString()
  });
});

/**
 * Liveness probe endpoint
 * Used by Kubernetes to check if the service is alive
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    alive: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
