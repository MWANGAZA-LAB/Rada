const axios = require('axios');
const base64 = require('base-64');

const { MPESAError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');
const { validatePhoneNumber, validateAmount } = require('../utils/validators');
const TokenManager = require('../utils/tokenManager');

class MPESAService {
  constructor() {
    this.config = {
      consumerKey: process.env.MPESA_CONSUMER_KEY,
      consumerSecret: process.env.MPESA_CONSUMER_SECRET,
      baseURL: process.env.MPESA_API_URL,
      shortcode: process.env.MPESA_SHORTCODE,
      passkey: process.env.MPESA_PASSKEY,
      callbackURL: process.env.CALLBACK_URL
    };
    this.tokenManager = new TokenManager(this.config);
    this.httpClient = axios.create({
      baseURL: this.config.baseURL,
      timeout: 10000
    });
  }

  /**
   * Get access token with caching and auto-refresh
   * @returns {Promise<string>} Access token
   */
  async getAccessToken() {
    try {
      return await this.tokenManager.getToken();
    } catch (error) {
      logger.error('Failed to get access token', { error: error.message });
      throw new MPESAError('Authentication failed', error);
    }
  }

  /**
   * Initiate STK Push request
   * @param {string} phone - Customer phone number
   * @param {number} amount - Transaction amount
   * @param {string} accountReference - Unique reference
   * @returns {Promise<Object>} STK Push response
   */
  async initiateSTKPush(phone, amount, accountReference) {
    try {
      // Validate input parameters
      this.validateSTKPushParams(phone, amount, accountReference);

      const token = await this.getAccessToken();
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(timestamp);

      const response = await this.httpClient.post(
        '/mpesa/stkpush/v1/processrequest',
        this.buildSTKPushPayload(phone, amount, accountReference, timestamp, password),
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      logger.info('STK Push initiated successfully', {
        phone: this.maskPhoneNumber(phone),
        reference: accountReference
      });

      return response.data;
    } catch (error) {
      logger.error('STK Push failed', {
        phone: this.maskPhoneNumber(phone),
        error: error.message
      });
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new MPESAError(
        'Failed to process payment request',
        error.response?.data || error
      );
    }
  }

  /**
   * Validate STK Push parameters
   * @private
   */
  validateSTKPushParams(phone, amount, reference) {
    if (!validatePhoneNumber(phone)) {
      throw new ValidationError('Invalid phone number format');
    }

    if (!validateAmount(amount)) {
      throw new ValidationError('Invalid amount');
    }

    if (!reference || typeof reference !== 'string') {
      throw new ValidationError('Invalid account reference');
    }
  }

  /**
   * Build STK Push request payload
   * @private
   */
  buildSTKPushPayload(phone, amount, reference, timestamp, password) {
    return {
      BusinessShortCode: this.config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(amount),
      PartyA: phone,
      PartyB: this.config.shortcode,
      PhoneNumber: phone,
      CallBackURL: `${this.config.callbackURL}/mpesa/callback`,
      AccountReference: reference,
      TransactionDesc: "Rada Bitcoin Payment"
    };
  }

  /**
   * Generate timestamp for M-PESA API
   * @private
   */
  generateTimestamp() {
    return new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
  }

  /**
   * Generate password for M-PESA API
   * @private
   */
  generatePassword(timestamp) {
    return base64.encode(
      `${this.config.shortcode}${this.config.passkey}${timestamp}`
    );
  }

  /**
   * Mask phone number for logging
   * @private
   */
  maskPhoneNumber(phone) {
    return `${phone.slice(0, 5)}****${phone.slice(-3)}`;
  }
}

module.exports = new MPESAService();
