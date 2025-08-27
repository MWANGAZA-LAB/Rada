const request = require('supertest');
const app = require('../../app');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

describe('Payment Integration Tests', () => {
  let pool;
  let testUser;
  let testToken;
  let testTransaction;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });

    // Create test user
    const userResult = await pool.query(
      'INSERT INTO users (phone_number, email) VALUES ($1, $2) RETURNING *',
      ['254700000000', 'test@example.com']
    );
    testUser = userResult.rows[0];

    // Create test wallet
    await pool.query(
      'INSERT INTO wallets (user_id, wallet_type, balance) VALUES ($1, $2, $3)',
      [testUser.id, 'phoenix', 10000]
    );

    // Generate test token
    testToken = jwt.sign(
      { userId: testUser.id, phoneNumber: testUser.phone_number },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await pool.query('DELETE FROM transactions WHERE user_id = $1', [testUser.id]);
    await pool.query('DELETE FROM wallets WHERE user_id = $1', [testUser.id]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    await pool.end();
  });

  describe('POST /api/v1/payments', () => {
    it('should create a payment successfully', async () => {
      const paymentData = {
        amount: 1000,
        currency: 'KES',
        paymentMethod: 'mpesa',
        description: 'Test payment',
        phoneNumber: '254700000000'
      };

      const response = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${testToken}`)
        .send(paymentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transaction).toBeDefined();
      expect(response.body.data.transaction.amount).toBe(1000);
      expect(response.body.data.transaction.paymentMethod).toBe('mpesa');
      expect(response.body.data.transaction.status).toBe('pending');

      testTransaction = response.body.data.transaction;
    });

    it('should validate required fields', async () => {
      const invalidData = {
        amount: 1000
        // Missing currency and paymentMethod
      };

      const response = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });

    it('should validate payment amount', async () => {
      const invalidData = {
        amount: -100,
        currency: 'KES',
        paymentMethod: 'mpesa'
      };

      const response = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate payment method', async () => {
      const invalidData = {
        amount: 1000,
        currency: 'KES',
        paymentMethod: 'invalid'
      };

      const response = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const paymentData = {
        amount: 1000,
        currency: 'KES',
        paymentMethod: 'mpesa'
      };

      await request(app)
        .post('/api/v1/payments')
        .send(paymentData)
        .expect(401);
    });
  });

  describe('GET /api/v1/payments', () => {
    it('should return user transactions with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${testToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should filter transactions by status', async () => {
      const response = await request(app)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${testToken}`)
        .query({ status: 'pending' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should filter transactions by payment method', async () => {
      const response = await request(app)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${testToken}`)
        .query({ paymentMethod: 'mpesa' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/payments')
        .expect(401);
    });
  });

  describe('GET /api/v1/payments/:transactionId', () => {
    it('should return transaction details', async () => {
      const response = await request(app)
        .get(`/api/v1/payments/${testTransaction.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testTransaction.id);
      expect(response.body.data.amount).toBe(1000);
    });

    it('should return 404 for non-existent transaction', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      await request(app)
        .get(`/api/v1/payments/${fakeId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/v1/payments/${testTransaction.id}`)
        .expect(401);
    });
  });

  describe('PUT /api/v1/payments/:transactionId/status', () => {
    it('should update transaction status', async () => {
      const updateData = {
        status: 'completed',
        metadata: { processedBy: 'system' }
      };

      const response = await request(app)
        .put(`/api/v1/payments/${testTransaction.id}/status`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
    });

    it('should validate transaction status', async () => {
      const invalidData = {
        status: 'invalid'
      };

      const response = await request(app)
        .put(`/api/v1/payments/${testTransaction.id}/status`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent transaction', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      await request(app)
        .put(`/api/v1/payments/${fakeId}/status`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ status: 'completed' })
        .expect(404);
    });
  });

  describe('GET /api/v1/payments/stats', () => {
    it('should return payment statistics', async () => {
      const response = await request(app)
        .get('/api/v1/payments/stats')
        .set('Authorization', `Bearer ${testToken}`)
        .query({ period: '30d' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.total_transactions).toBeDefined();
    });

    it('should validate period parameter', async () => {
      const response = await request(app)
        .get('/api/v1/payments/stats')
        .set('Authorization', `Bearer ${testToken}`)
        .query({ period: 'invalid' })
        .expect(200); // Should use default period

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/payments/:transactionId/cancel', () => {
    it('should cancel a pending transaction', async () => {
      // Create a new pending transaction for cancellation
      const paymentData = {
        amount: 500,
        currency: 'KES',
        paymentMethod: 'mpesa',
        description: 'Transaction to cancel'
      };

      const createResponse = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${testToken}`)
        .send(paymentData)
        .expect(200);

      const transactionToCancel = createResponse.body.data.transaction;

      const response = await request(app)
        .post(`/api/v1/payments/${transactionToCancel.id}/cancel`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
    });

    it('should not allow cancellation of non-pending transactions', async () => {
      // Try to cancel the already completed transaction
      await request(app)
        .post(`/api/v1/payments/${testTransaction.id}/cancel`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(400);
    });
  });

  describe('GET /api/v1/payments/methods', () => {
    it('should return available payment methods', async () => {
      const response = await request(app)
        .get('/api/v1/payments/methods')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const mpesaMethod = response.body.data.find(m => m.id === 'mpesa');
      expect(mpesaMethod).toBeDefined();
      expect(mpesaMethod.name).toBe('M-Pesa');
      expect(mpesaMethod.supportedCurrencies).toContain('KES');
    });
  });

  describe('POST /api/v1/payments/validate', () => {
    it('should validate payment data successfully', async () => {
      const validationData = {
        amount: 1000,
        currency: 'KES',
        paymentMethod: 'mpesa',
        phoneNumber: '254700000000'
      };

      const response = await request(app)
        .post('/api/v1/payments/validate')
        .set('Authorization', `Bearer ${testToken}`)
        .send(validationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.estimatedFees).toBeDefined();
      expect(response.body.data.processingTime).toBeDefined();
    });

    it('should return validation errors for invalid data', async () => {
      const invalidData = {
        amount: 1000,
        currency: 'KES',
        paymentMethod: 'bitcoin'
        // Missing walletAddress for Bitcoin
      };

      const response = await request(app)
        .post('/api/v1/payments/validate')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting on payment creation', async () => {
      const paymentData = {
        amount: 100,
        currency: 'KES',
        paymentMethod: 'mpesa'
      };

      // Make multiple rapid requests
      const promises = Array(10).fill().map(() =>
        request(app)
          .post('/api/v1/payments')
          .set('Authorization', `Bearer ${testToken}`)
          .send(paymentData)
      );

      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r.status === 429);

      expect(rateLimited).toBe(true);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/v1/payments/methods')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });
});
