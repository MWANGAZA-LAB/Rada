class BaseError extends Error {
  constructor(message, statusCode, errorCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends BaseError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

class AuthenticationError extends BaseError {
  constructor(message) {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends BaseError {
  constructor(message) {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends BaseError {
  constructor(message) {
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

class PaymentError extends BaseError {
  constructor(message, originalError) {
    super(message, 422, 'PAYMENT_ERROR');
    this.originalError = originalError;
  }
}

class RateLimitError extends BaseError {
  constructor(message) {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

class DatabaseError extends BaseError {
  constructor(message, originalError) {
    super(message, 500, 'DATABASE_ERROR', false);
    this.originalError = originalError;
  }
}

module.exports = {
  BaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  PaymentError,
  RateLimitError,
  DatabaseError
};
