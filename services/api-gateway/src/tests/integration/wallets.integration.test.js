const request = require('supertest');
const app = require('../../app');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

describe('Wallet Integration Tests', () => {
  let pool;
  let testUser;
  let testToken;
  let testWallet;

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

    // Generate test token
    testToken = jwt.sign(
      { userId: testUser.id, phoneNumber: testUser.phone_number },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await pool.query('DELETE FROM wallets WHERE user_id = $1', [testUser.id]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    await pool.end();
  });

  describe('POST /api/v1/wallets', () => {
    it('should create a wallet successfully', async () => {
      const walletData = {
        walletType: 'phoenix',
        lightningAddress: 'user@example.com'
      };

      const response = await request(app)
        .post('/api/v1/wallets')
        .set('Authorization', `Bearer ${testToken}`)
        .send(walletData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.walletType).toBe('phoenix');
      expect(response.body.data.lightningAddress).toBe('user@example.com');
      expect(response.body.data.balance).toBe(0);

      testWallet = response.body.data;
    });

    it('should validate wallet type', async () => {
      const invalidData = {
        walletType: 'invalid',
        lightningAddress: 'user@example.com'
      };

      const response = await request(app)
        .post('/api/v1/wallets')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Validation failed');
    });

    it('should not allow creating multiple wallets for same user', async () => {
      const walletData = {
        walletType: 'breez',
        lightningAddress: 'user2@example.com'
      };

      const response = await request(app)
        .post('/api/v1/wallets')
        .set('Authorization', `Bearer ${testToken}`)
        .send(walletData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('User already has a wallet');
    });

    it('should require authentication', async () => {
      const walletData = {
        walletType: 'phoenix',
        lightningAddress: 'user@example.com'
      };

      await request(app)
        .post('/api/v1/wallets')
        .send(walletData)
        .expect(401);
    });
  });

  describe('GET /api/v1/wallets/balance', () => {
    it('should return wallet balance', async () => {
      const response = await request(app)
        .get('/api/v1/wallets/balance')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.balance).toBeDefined();
      expect(response.body.data.confirmedBalance).toBeDefined();
      expect(response.body.data.unconfirmedBalance).toBeDefined();
      expect(response.body.data.totalBalance).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/wallets/balance')
        .expect(401);
    });
  });

  describe('GET /api/v1/wallets', () => {
    it('should return wallet details', async () => {
      const response = await request(app)
        .get('/api/v1/wallets')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(testWallet.id);
      expect(response.body.data.walletType).toBe('phoenix');
      expect(response.body.data.lightningAddress).toBe('user@example.com');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/wallets')
        .expect(401);
    });
  });

  describe('PUT /api/v1/wallets', () => {
    it('should update wallet settings', async () => {
      const updateData = {
        walletType: 'breez',
        lightningAddress: 'newuser@example.com'
      };

      const response = await request(app)
        .put('/api/v1/wallets')
        .set('Authorization', `Bearer ${testToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.walletType).toBe('breez');
      expect(response.body.data.lightningAddress).toBe('newuser@example.com');
    });

    it('should validate wallet type on update', async () => {
      const invalidData = {
        walletType: 'invalid'
      };

      const response = await request(app)
        .put('/api/v1/wallets')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const updateData = {
        walletType: 'breez'
      };

      await request(app)
        .put('/api/v1/wallets')
        .send(updateData)
        .expect(401);
    });
  });

  describe('GET /api/v1/wallets/transactions', () => {
    it('should return wallet transactions with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/wallets/transactions')
        .set('Authorization', `Bearer ${testToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    it('should filter transactions by type', async () => {
      const response = await request(app)
        .get('/api/v1/wallets/transactions')
        .set('Authorization', `Bearer ${testToken}`)
        .query({ type: 'credit' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/wallets/transactions')
        .expect(401);
    });
  });

  describe('GET /api/v1/wallets/stats', () => {
    it('should return wallet statistics', async () => {
      const response = await request(app)
        .get('/api/v1/wallets/stats')
        .set('Authorization', `Bearer ${testToken}`)
        .query({ period: '30d' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.total_transactions).toBeDefined();
      expect(response.body.data.credit_transactions).toBeDefined();
      expect(response.body.data.debit_transactions).toBeDefined();
    });

    it('should validate period parameter', async () => {
      const response = await request(app)
        .get('/api/v1/wallets/stats')
        .set('Authorization', `Bearer ${testToken}`)
        .query({ period: 'invalid' })
        .expect(200); // Should use default period

      expect(response.body.success).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/wallets/stats')
        .expect(401);
    });
  });

  describe('POST /api/v1/wallets/credit', () => {
    it('should credit wallet balance', async () => {
      const creditData = {
        amount: 1000,
        metadata: { source: 'test' }
      };

      const response = await request(app)
        .post('/api/v1/wallets/credit')
        .set('Authorization', `Bearer ${testToken}`)
        .send(creditData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.amount).toBe(1000);
      expect(response.body.data.operation).toBe('credit');
      expect(response.body.data.newBalance).toBeGreaterThan(0);
    });

    it('should validate credit amount', async () => {
      const invalidData = {
        amount: -100
      };

      const response = await request(app)
        .post('/api/v1/wallets/credit')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const creditData = {
        amount: 1000
      };

      await request(app)
        .post('/api/v1/wallets/credit')
        .send(creditData)
        .expect(401);
    });
  });

  describe('POST /api/v1/wallets/debit', () => {
    it('should debit wallet balance', async () => {
      const debitData = {
        amount: 500,
        metadata: { purpose: 'test' }
      };

      const response = await request(app)
        .post('/api/v1/wallets/debit')
        .set('Authorization', `Bearer ${testToken}`)
        .send(debitData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.amount).toBe(500);
      expect(response.body.data.operation).toBe('debit');
    });

    it('should validate debit amount', async () => {
      const invalidData = {
        amount: -100
      };

      const response = await request(app)
        .post('/api/v1/wallets/debit')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should prevent insufficient balance debit', async () => {
      const largeAmount = {
        amount: 1000000 // Very large amount
      };

      const response = await request(app)
        .post('/api/v1/wallets/debit')
        .set('Authorization', `Bearer ${testToken}`)
        .send(largeAmount)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Insufficient balance');
    });

    it('should require authentication', async () => {
      const debitData = {
        amount: 100
      };

      await request(app)
        .post('/api/v1/wallets/debit')
        .send(debitData)
        .expect(401);
    });
  });

  describe('GET /api/v1/wallets/:walletId', () => {
    it('should return wallet by ID for owner', async () => {
      const response = await request(app)
        .get(`/api/v1/wallets/${testWallet.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testWallet.id);
      expect(response.body.data.userId).toBe(testUser.id);
    });

    it('should return 404 for non-existent wallet', async () => {
      const fakeId = '123e4567-e89b-12d3-a456-426614174000';
      
      await request(app)
        .get(`/api/v1/wallets/${fakeId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/v1/wallets/${testWallet.id}`)
        .expect(401);
    });
  });

  describe('GET /api/v1/wallets/balance/refresh', () => {
    it('should refresh wallet balance', async () => {
      const response = await request(app)
        .get('/api/v1/wallets/balance/refresh')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.balance).toBeDefined();
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/wallets/balance/refresh')
        .expect(401);
    });
  });

  describe('GET /api/v1/wallets/supported-types', () => {
    it('should return supported wallet types', async () => {
      const response = await request(app)
        .get('/api/v1/wallets/supported-types')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const phoenixWallet = response.body.data.find(w => w.id === 'phoenix');
      expect(phoenixWallet).toBeDefined();
      expect(phoenixWallet.name).toBe('Phoenix Wallet');
      expect(phoenixWallet.features).toContain('Lightning Network');
    });
  });

  describe('POST /api/v1/wallets/validate-address', () => {
    it('should validate Lightning address successfully', async () => {
      const validationData = {
        lightningAddress: 'user@example.com'
      };

      const response = await request(app)
        .post('/api/v1/wallets/validate-address')
        .set('Authorization', `Bearer ${testToken}`)
        .send(validationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.address).toBe('user@example.com');
    });

    it('should reject invalid Lightning address', async () => {
      const invalidData = {
        lightningAddress: 'invalid-address'
      };

      const response = await request(app)
        .post('/api/v1/wallets/validate-address')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(false);
    });

    it('should require authentication', async () => {
      const validationData = {
        lightningAddress: 'user@example.com'
      };

      await request(app)
        .post('/api/v1/wallets/validate-address')
        .send(validationData)
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting on wallet operations', async () => {
      const creditData = {
        amount: 100
      };

      // Make multiple rapid requests
      const promises = Array(10).fill().map(() =>
        request(app)
          .post('/api/v1/wallets/credit')
          .set('Authorization', `Bearer ${testToken}`)
          .send(creditData)
      );

      const responses = await Promise.all(promises);
      const rateLimited = responses.some(r => r.status === 429);

      expect(rateLimited).toBe(true);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/v1/wallets/supported-types')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll test that the API structure is correct
      const response = await request(app)
        .get('/api/v1/wallets/balance')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
    });

    it('should return proper error format for validation failures', async () => {
      const invalidData = {
        amount: 'not-a-number'
      };

      const response = await request(app)
        .post('/api/v1/wallets/credit')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('errors');
    });
  });
});
