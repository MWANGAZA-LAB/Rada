// Test setup configuration
require('dotenv').config({ path: '.env.test' });

// Global test configuration
global.testConfig = {
  database: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: process.env.TEST_DB_PORT || 5432,
    database: process.env.TEST_DB_NAME || 'rada_test',
    username: process.env.TEST_DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'postgres'
  },
  redis: {
    host: process.env.TEST_REDIS_HOST || 'localhost',
    port: process.env.TEST_REDIS_PORT || 6379,
    password: process.env.TEST_REDIS_PASSWORD || null
  }
};

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock logger
jest.mock('../utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };
  
  return {
    logger: mockLogger,
    requestLogger: jest.fn(),
    errorLogger: jest.fn(),
    performanceLogger: jest.fn(),
    securityLogger: jest.fn(),
    businessLogger: jest.fn(),
    default: mockLogger
  };
});

// Global test utilities
global.testUtils = {
  // Generate test JWT token
  generateTestToken: (payload = {}) => {
    const jwt = require('jsonwebtoken');
    const defaultPayload = {
      userId: 'test-user-id',
      phoneNumber: '254712345678',
      ...payload
    };
    return jwt.sign(defaultPayload, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
  },

  // Generate test user data
  generateTestUser: (overrides = {}) => ({
    id: 'test-user-id',
    phone_number: '254712345678',
    email: 'test@example.com',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  }),

  // Generate test transaction data
  generateTestTransaction: (overrides = {}) => ({
    id: 'test-transaction-id',
    user_id: 'test-user-id',
    merchant_id: 'test-merchant-id',
    type: 'payment',
    bitcoin_amount: 100000, // 1000 sats
    kes_amount: 1000.00,
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  }),

  // Clean up test data
  cleanupTestData: async (pool) => {
    try {
      await pool.query('DELETE FROM audit_logs');
      await pool.query('DELETE FROM bitcoin_transactions');
      await pool.query('DELETE FROM mpesa_transactions');
      await pool.query('DELETE FROM transactions');
      await pool.query('DELETE FROM wallets');
      await pool.query('DELETE FROM merchants');
      await pool.query('DELETE FROM users');
      await pool.query('DELETE FROM exchange_rates');
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  },

  // Setup test database
  setupTestDatabase: async (pool) => {
    try {
      // Create test tables if they don't exist
      const schema = require('../../../database/optimized_schema.sql');
      await pool.query(schema);
    } catch (error) {
      console.error('Error setting up test database:', error);
    }
  }
};

// Global test matchers
expect.extend({
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false
      };
    }
  },

  toBeValidPhoneNumber(received) {
    const phoneRegex = /^254[17]\d{8}$/;
    const pass = phoneRegex.test(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid Kenyan phone number`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid Kenyan phone number`,
        pass: false
      };
    }
  }
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});
