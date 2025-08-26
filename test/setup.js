require('dotenv').config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Test database configuration
process.env.TEST_DATABASE_URL = 'postgresql://test:test@localhost:5432/rada_test';

// Test LND configuration
process.env.TEST_LND_CERT = process.env.LND_CERT;
process.env.TEST_LND_MACAROON = process.env.LND_MACAROON;
process.env.TEST_LND_GRPC_HOST = 'localhost:10009';

// Test M-PESA configuration
process.env.MPESA_API_URL = 'https://sandbox.safaricom.co.ke';
process.env.MPESA_CONSUMER_KEY = 'test_consumer_key';
process.env.MPESA_CONSUMER_SECRET = 'test_consumer_secret';

// JWT configuration
process.env.JWT_SECRET = 'test_jwt_secret';

// Redis configuration
process.env.REDIS_URL = 'redis://localhost:6379/1';

// Global test timeout
jest.setTimeout(30000);
