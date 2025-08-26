const request = require('supertest');
const app = require('../src/app');
const MPESAService = require('../src/services/mpesa');
const nock = require('nock');

describe('M-PESA Service Integration Tests', () => {
  beforeEach(() => {
    // Mock the M-PESA API endpoints
    nock(process.env.MPESA_API_URL)
      .get('/oauth/v1/generate')
      .reply(200, {
        access_token: 'test_token'
      });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('STK Push Integration', () => {
    it('should initiate STK push successfully', async () => {
      // Mock the STK push endpoint
      nock(process.env.MPESA_API_URL)
        .post('/mpesa/stkpush/v1/processrequest')
        .reply(200, {
          MerchantRequestID: '12345',
          CheckoutRequestID: '67890',
          ResponseCode: '0',
          ResponseDescription: 'Success'
        });

      const response = await request(app)
        .post('/api/payment/initiate')
        .send({
          phoneNumber: '254712345678',
          amount: 100,
          accountReference: 'TEST001'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('MerchantRequestID');
      expect(response.body).toHaveProperty('CheckoutRequestID');
    });

    it('should handle STK push failure', async () => {
      nock(process.env.MPESA_API_URL)
        .post('/mpesa/stkpush/v1/processrequest')
        .reply(400, {
          errorCode: 'ERROR',
          errorMessage: 'Invalid phone number'
        });

      const response = await request(app)
        .post('/api/payment/initiate')
        .send({
          phoneNumber: 'invalid',
          amount: 100,
          accountReference: 'TEST001'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Transaction Status Check', () => {
    it('should check transaction status successfully', async () => {
      nock(process.env.MPESA_API_URL)
        .post('/mpesa/stkpushquery/v1/query')
        .reply(200, {
          ResultCode: '0',
          ResultDesc: 'The service request was successful.',
          MerchantRequestID: '12345',
          CheckoutRequestID: '67890',
          ResponseCode: '0',
          ResponseDescription: 'Success'
        });

      const response = await request(app)
        .get('/api/payment/status/12345');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ResultCode', '0');
    });
  });

  describe('Callback Handling', () => {
    it('should process M-PESA callback successfully', async () => {
      const callbackData = {
        Body: {
          stkCallback: {
            MerchantRequestID: '12345',
            CheckoutRequestID: '67890',
            ResultCode: 0,
            ResultDesc: 'The service request is processed successfully.'
          }
        }
      };

      const response = await request(app)
        .post('/api/payment/callback')
        .send(callbackData);

      expect(response.status).toBe(200);
    });
  });
});
