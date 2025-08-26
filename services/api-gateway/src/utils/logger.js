const winston = require('winston');
const { format } = winston;
require('winston-daily-rotate-file');

// Custom format for structured logging
const customFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.metadata(),
  format.json()
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { 
    service: 'rada-api',
    environment: process.env.NODE_ENV
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),

    // Rotating file transport for errors
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      maxSize: '100m'
    }),

    // Rotating file transport for all logs
    new winston.transports.DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '100m'
    })
  ]
});

// Add request context if available
logger.requestContext = (req) => {
  return {
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: req.user?.id
  };
};

// Log method wrappers with request context
['error', 'warn', 'info', 'debug'].forEach(level => {
  const originalMethod = logger[level].bind(logger);
  logger[level] = (message, meta = {}) => {
    if (meta.req) {
      meta = {
        ...meta,
        context: logger.requestContext(meta.req)
      };
      delete meta.req;
    }
    return originalMethod(message, meta);
  };
});

// Performance monitoring
logger.startTimer = () => {
  return {
    start: process.hrtime(),
    end: (meta = {}) => {
      const diff = process.hrtime(this.start);
      const duration = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(3);
      logger.info('Operation completed', { 
        ...meta,
        duration_ms: parseFloat(duration)
      });
      return duration;
    }
  };
};

module.exports = logger;
