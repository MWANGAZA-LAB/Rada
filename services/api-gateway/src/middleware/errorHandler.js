const logger = require('../utils/logger');
const { BaseError } = require('../utils/errors');

const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error('Error occurred', {
    error: {
      message: err.message,
      stack: err.stack,
      code: err.errorCode,
      originalError: err.originalError
    },
    request: {
      method: req.method,
      path: req.path,
      params: req.params,
      query: req.query,
      body: req.body,
      ip: req.ip
    }
  });

  // If error is operational (expected), send appropriate response
  if (err instanceof BaseError) {
    return res.status(err.statusCode).json({
      status: 'error',
      code: err.errorCode,
      message: err.message
    });
  }

  // For unexpected errors, send generic response in production
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    });
  }

  // In development, send full error details
  return res.status(500).json({
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: err.message,
    stack: err.stack
  });
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: {
      message: error.message,
      stack: error.stack
    }
  });
  
  // Perform graceful shutdown
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.stack : reason,
    promise
  });
});

module.exports = errorHandler;
