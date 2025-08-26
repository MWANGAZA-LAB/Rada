const axios = require('axios');
const Redis = require('redis');
const schedule = require('node-schedule');

class ExchangeRateService {
  constructor() {
    this.redis = Redis.createClient({
      url: process.env.REDIS_URL
    });
    this.redis.connect();
    
    // Update rates every 5 minutes
    schedule.scheduleJob('*/5 * * * *', () => this.updateRates());
  }

  async updateRates() {
    try {
      // Get rates from multiple sources for redundancy
      const [binanceRate, coinGeckoRate] = await Promise.all([
        this.getBinanceRate(),
        this.getCoinGeckoRate()
      ]);

      // Calculate average rate
      const averageRate = (binanceRate + coinGeckoRate) / 2;

      // Store in Redis with 5 minute expiry
      await this.redis.set('btc_kes_rate', averageRate, {
        EX: 300 // 5 minutes
      });

      // Store in database for historical tracking
      await this.storeRateInDB(averageRate);

      return averageRate;
    } catch (error) {
      console.error('Failed to update exchange rates:', error);
      throw error;
    }
  }

  async getBinanceRate() {
    const response = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
    const usdtRate = parseFloat(response.data.price);
    
    // Get USDT/KES rate
    const kesResponse = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=USDTKES');
    const kesRate = parseFloat(kesResponse.data.price);
    
    return usdtRate * kesRate;
  }

  async getCoinGeckoRate() {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=kes'
    );
    return response.data.bitcoin.kes;
  }

  async getCurrentRate() {
    try {
      const cachedRate = await this.redis.get('btc_kes_rate');
      if (cachedRate) {
        return parseFloat(cachedRate);
      }
      return await this.updateRates();
    } catch (error) {
      console.error('Failed to get current rate:', error);
      throw error;
    }
  }

  async storeRateInDB(rate) {
    // Store rate in PostgreSQL for historical data
    const query = {
      text: 'INSERT INTO exchange_rates(btc_to_kes, source) VALUES($1, $2)',
      values: [rate, 'aggregated'],
    };
    await pool.query(query);
  }
}

module.exports = new ExchangeRateService();
