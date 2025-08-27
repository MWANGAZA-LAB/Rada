class ResponseHandler {
  static success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      status: 'success',
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  static error(res, error, statusCode = 500) {
    const response = {
      status: 'error',
      message: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    };

    // Add error code if available
    if (error.errorCode) {
      response.code = error.errorCode;
    }

    // Add validation errors if available
    if (error.validationErrors) {
      response.errors = error.validationErrors;
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
      response.stack = error.stack;
    }

    return res.status(statusCode).json(response);
  }

  static validationError(res, errors) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors,
      timestamp: new Date().toISOString()
    });
  }

  static notFound(res, message = 'Resource not found') {
    return res.status(404).json({
      status: 'error',
      code: 'NOT_FOUND',
      message,
      timestamp: new Date().toISOString()
    });
  }

  static unauthorized(res, message = 'Unauthorized') {
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message,
      timestamp: new Date().toISOString()
    });
  }

  static forbidden(res, message = 'Forbidden') {
    return res.status(403).json({
      status: 'error',
      code: 'FORBIDDEN',
      message,
      timestamp: new Date().toISOString()
    });
  }

  static conflict(res, message = 'Resource conflict') {
    return res.status(409).json({
      status: 'error',
      code: 'CONFLICT',
      message,
      timestamp: new Date().toISOString()
    });
  }

  static tooManyRequests(res, message = 'Too many requests', retryAfter = null) {
    const response = {
      status: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message,
      timestamp: new Date().toISOString()
    };

    if (retryAfter) {
      response.retryAfter = retryAfter;
    }

    return res.status(429).json(response);
  }

  static paginated(res, data, pagination, message = 'Success') {
    return res.status(200).json({
      status: 'success',
      message,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        hasNext: pagination.page < Math.ceil(pagination.total / pagination.limit),
        hasPrev: pagination.page > 1
      },
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = ResponseHandler;
