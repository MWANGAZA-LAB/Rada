const request = require('supertest');
const app = require('../src/app');
const Redis = require('redis-mock');
const nock = require('nock');
const ExchangeRateService = require('../src/services/exchangeRate');

describe('Exchange Rate Service Integration Tests', () => {
  let redisClient;

  beforeAll(async () => {
    redisClient = Redis.createClient();
    await redisClient.connect();
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  beforeEach(() => {
    // Mock external API endpoints
    nock('https://api.binance.com')
      .get('/api/v3/ticker/price?symbol=BTCUSDT')
      .reply(200, {
        symbol: 'BTCUSDT',
        price: '50000.00'
      });

    nock('https://api.binance.com')
      .get('/api/v3/ticker/price?symbol=USDTKES')
      .reply(200, {
        symbol: 'USDTKES',
        price: '145.00'
      });

    nock('https://api.coingecko.com')
      .get('/api/v3/simple/price?ids=bitcoin&vs_currencies=kes')
      .reply(200, {
        bitcoin: {
          kes: 7250000
        }
      });
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('GET /api/exchange/rate', () => {
    it('should return current exchange rate', async () => {
      const response = await request(app)
        .get('/api/exchange/rate');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rate');
      expect(typeof response.body.rate).toBe('number');
    });

    it('should use cached rate when available', async () => {
      // Set cached rate
      await redisClient.set('btc_kes_rate', '7250000');

      const response = await request(app)
        .get('/api/exchange/rate');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rate', 7250000);
    });
  });

  describe('Exchange Rate Updates', () => {
    it('should update rates from multiple sources', async () => {
      const rate = await ExchangeRateService.updateRates();
      
      expect(typeof rate).toBe('number');
      expect(rate).toBeGreaterThan(0);

      // Verify rate was stored in Redis
      const cachedRate = await redisClient.get('btc_kes_rate');
      expect(cachedRate).toBeDefined();
      expect(parseFloat(cachedRate)).toBe(rate);
    });

    it('should handle API failures gracefully', async () => {
      nock.cleanAll();
      
      // Mock API failure
      nock('https://api.binance.com')
        .get('/api/v3/ticker/price?symbol=BTCUSDT')
        .replyWithError('API unavailable');

      const response = await request(app)
        .get('/api/exchange/rate');

      // Should fall back to CoinGecko rate
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rate');
    });
  });

  describe('Historical Rates', () => {
    it('should store historical rates in database', async () => {
      const rate = await ExchangeRateService.updateRates();
      
      const response = await request(app)
        .get('/api/exchange/historical');

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body[0]).toHaveProperty('btc_to_kes');
      expect(response.body[0]).toHaveProperty('created_at');
    });
  });
});
