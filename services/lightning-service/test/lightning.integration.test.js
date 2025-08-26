const request = require('supertest');
const app = require('../src/app');
const { authenticateLnd } = require('ln-service');

describe('Lightning Service Integration Tests', () => {
  let lnd;

  beforeAll(async () => {
    // Connect to test LND node
    lnd = authenticateLnd({
      cert: process.env.TEST_LND_CERT,
      macaroon: process.env.TEST_LND_MACAROON,
      socket: process.env.TEST_LND_GRPC_HOST
    });
  });

  describe('POST /api/invoice/create', () => {
    it('should create a lightning invoice', async () => {
      const response = await request(app)
        .post('/api/invoice/create')
        .send({
          amount: 1000, // 1000 satoshis
          memo: 'Test Payment'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('paymentRequest');
      expect(response.body).toHaveProperty('paymentHash');
    });

    it('should fail with invalid amount', async () => {
      const response = await request(app)
        .post('/api/invoice/create')
        .send({
          amount: -1000,
          memo: 'Test Payment'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/invoice/pay', () => {
    it('should pay a test invoice', async () => {
      // First create a test invoice
      const createResponse = await request(app)
        .post('/api/invoice/create')
        .send({
          amount: 1000,
          memo: 'Test Payment'
        });

      const payResponse = await request(app)
        .post('/api/invoice/pay')
        .send({
          paymentRequest: createResponse.body.paymentRequest
        });

      expect(payResponse.status).toBe(200);
      expect(payResponse.body).toHaveProperty('success', true);
      expect(payResponse.body).toHaveProperty('paymentHash');
      expect(payResponse.body).toHaveProperty('fee');
    });

    it('should fail with invalid payment request', async () => {
      const response = await request(app)
        .post('/api/invoice/pay')
        .send({
          paymentRequest: 'invalid_request'
        });

      expect(response.status).toBe(400);
    });
  });
});
