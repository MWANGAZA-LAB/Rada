const winston = require('winston');
const { format } = winston;

// Custom format for structured logging
const logFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json()
);

// Console format for development
const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'rada-api',
    version: process.env.APP_VERSION || '1.0.0'
  },
  transports: [
    // Error logs
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: logFormat
    }),
    
    // Combined logs
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: logFormat
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.userId,
      requestId: req.headers['x-request-id'] || 'unknown'
    };

    if (res.statusCode >= 400) {
      logger.error('API Request Error', logData);
    } else {
      logger.info('API Request', logData);
    }
  });

  next();
};

// Error logging middleware
const errorLogger = (error, req, res, next) => {
  logger.error('Unhandled Error', {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userId: req.user?.userId,
      requestId: req.headers['x-request-id'] || 'unknown'
    }
  });
  
  next(error);
};

// Performance logging
const performanceLogger = (operation, duration, metadata = {}) => {
  logger.info('Performance Metric', {
    operation,
    duration,
    ...metadata
  });
};

// Security event logging
const securityLogger = (event, details) => {
  logger.warn('Security Event', {
    event,
    details,
    timestamp: new Date().toISOString()
  });
};

// Business event logging
const businessLogger = (event, data) => {
  logger.info('Business Event', {
    event,
    data,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  logger,
  requestLogger,
  errorLogger,
  performanceLogger,
  securityLogger,
  businessLogger
};
