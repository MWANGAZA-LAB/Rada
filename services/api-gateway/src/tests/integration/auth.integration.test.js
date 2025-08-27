const request = require('supertest');
const app = require('../../app');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

describe('Authentication Integration Tests', () => {
  let pool;
  let testUser;

  beforeAll(async () => {
    // Setup test database connection
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rada_test'
    });

    // Clean up any existing test data
    await pool.query('DELETE FROM users WHERE phone_number IN ($1, $2)', [
      '254712345678',
      '254787654321'
    ]);
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      await pool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    }
    await pool.end();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        phoneNumber: '254712345678',
        email: 'test@example.com'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('data.token');
      expect(response.body).toHaveProperty('data.user');
      expect(response.body.data.user).toHaveProperty('phoneNumber', '254712345678');
      expect(response.body.data.user).toHaveProperty('email', 'test@example.com');
      expect(response.body.data.user).toHaveProperty('id');

      // Store test user for cleanup
      testUser = response.body.data.user;
    });

    it('should fail with invalid phone number format', async () => {
      const userData = {
        phoneNumber: '1234567890', // Invalid format
        email: 'test@example.com'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should fail with invalid email format', async () => {
      const userData = {
        phoneNumber: '254712345678',
        email: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should fail with duplicate phone number', async () => {
      const userData = {
        phoneNumber: '254712345678', // Already registered
        email: 'duplicate@example.com'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should fail with missing required fields', async () => {
      const userData = {
        email: 'test@example.com'
        // Missing phoneNumber
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login existing user successfully', async () => {
      const loginData = {
        phoneNumber: '254712345678'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('data.token');
      expect(response.body).toHaveProperty('data.user');
      expect(response.body.data.user).toHaveProperty('phoneNumber', '254712345678');
      expect(response.body.data.user).toHaveProperty('id');
    });

    it('should fail with non-existent phone number', async () => {
      const loginData = {
        phoneNumber: '254700000000'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message', 'User not found');
    });

    it('should fail with invalid phone number format', async () => {
      const loginData = {
        phoneNumber: '1234567890'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let authToken;

    beforeEach(() => {
      // Create a valid JWT token for testing
      authToken = jwt.sign(
        { userId: testUser?.id || 'test-user-id', phoneNumber: '254712345678' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('phoneNumber', '254712345678');
      expect(response.body.data).toHaveProperty('email', 'test@example.com');
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('code', 'AUTHENTICATION_ERROR');
    });

    it('should fail with missing token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should fail with expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: testUser?.id || 'test-user-id', phoneNumber: '254712345678' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('code', 'AUTHENTICATION_ERROR');
    });
  });

  describe('PUT /api/v1/auth/me', () => {
    let authToken;

    beforeEach(() => {
      authToken = jwt.sign(
        { userId: testUser?.id || 'test-user-id', phoneNumber: '254712345678' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
    });

    it('should update user profile successfully', async () => {
      const updateData = {
        email: 'updated@example.com',
        lightningAddress: 'user@phoenix.wallet',
        walletType: 'phoenix'
      };

      const response = await request(app)
        .put('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('email', 'updated@example.com');
      expect(response.body.data).toHaveProperty('lightningAddress', 'user@phoenix.wallet');
      expect(response.body.data).toHaveProperty('walletType', 'phoenix');
    });

    it('should fail with invalid email format', async () => {
      const updateData = {
        email: 'invalid-email'
      };

      const response = await request(app)
        .put('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should fail with invalid wallet type', async () => {
      const updateData = {
        walletType: 'invalid-wallet'
      };

      const response = await request(app)
        .put('/api/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let authToken;

    beforeEach(() => {
      authToken = jwt.sign(
        { userId: testUser?.id || 'test-user-id', phoneNumber: '254712345678' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );
    });

    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('data.token');
      expect(response.body).toHaveProperty('data.user');
      expect(response.body.data.user).toHaveProperty('phoneNumber', '254712345678');
    });

    it('should fail with invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('code', 'AUTHENTICATION_ERROR');
    });
  });

  describe('Rate Limiting', () => {
    it('should limit repeated login attempts', async () => {
      const loginData = {
        phoneNumber: '254700000000' // Non-existent user
      };

      // Make multiple requests to trigger rate limiting
      for (let i = 0; i < 6; i++) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send(loginData);

        if (i < 5) {
          expect(response.status).toBe(404); // User not found
        } else {
          expect(response.status).toBe(429); // Rate limited
          expect(response.body).toHaveProperty('status', 'error');
          expect(response.body).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
        }
      }
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });
});
