const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

describe('API Gateway Integration Tests', () => {
  let pool;
  let testUser;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL
    });

    // Create test user
    const result = await pool.query(`
      INSERT INTO users (phone_number, email)
      VALUES ($1, $2)
      RETURNING id, phone_number, email
    `, ['254712345678', 'test@example.com']);
    
    testUser = result.rows[0];
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
    await pool.end();
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('should register a new user', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            phoneNumber: '254787654321',
            email: 'newuser@example.com'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('user');
        expect(response.body.user).toHaveProperty('phone_number', '254787654321');
      });

      it('should fail with duplicate phone number', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            phoneNumber: '254712345678',
            email: 'duplicate@example.com'
          });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login existing user', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            phoneNumber: '254712345678'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('user');
        expect(response.body.user.id).toBe(testUser.id);
      });

      it('should fail with invalid phone number', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            phoneNumber: '254700000000'
          });

        expect(response.status).toBe(404);
      });
    });

    describe('GET /api/auth/me', () => {
      it('should return user profile with valid token', async () => {
        const token = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET);

        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id', testUser.id);
        expect(response.body).toHaveProperty('phone_number', testUser.phone_number);
      });

      it('should fail with invalid token', async () => {
        const response = await request(app)
          .get('/api/auth/me')
          .set('Authorization', 'Bearer invalid_token');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Protected Routes', () => {
    let authToken;

    beforeEach(() => {
      authToken = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET);
    });

    describe('GET /api/transactions', () => {
      it('should return user transactions', async () => {
        const response = await request(app)
          .get('/api/transactions')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe('POST /api/wallet/connect', () => {
      it('should connect lightning wallet', async () => {
        const response = await request(app)
          .post('/api/wallet/connect')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            walletType: 'phoenix',
            lightningAddress: 'user@phoenix.wallet'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });
    });
  });
});
