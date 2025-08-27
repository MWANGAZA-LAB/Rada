const { Pool } = require('pg');
const { ValidationError, NotFoundError, DatabaseError } = require('../utils/errors');
const logger = require('../utils/logger');

class MerchantService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  async findByApiKey(apiKey) {
    try {
      const query = `
        SELECT id, business_name, mpesa_shortcode, mpesa_phone, contact_email, verification_status
        FROM merchants 
        WHERE api_key = $1 AND verification_status = 'verified'
      `;
      
      const result = await this.pool.query(query, [apiKey]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding merchant by API key', { error: error.message });
      throw new DatabaseError('Failed to find merchant', error);
    }
  }

  async findById(merchantId) {
    try {
      const query = `
        SELECT id, business_name, mpesa_shortcode, mpesa_phone, contact_email, verification_status, created_at
        FROM merchants 
        WHERE id = $1
      `;
      
      const result = await this.pool.query(query, [merchantId]);
      
      if (!result.rows[0]) {
        throw new NotFoundError('Merchant not found');
      }
      
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error finding merchant by ID', { error: error.message, merchantId });
      throw new DatabaseError('Failed to find merchant', error);
    }
  }

  async createMerchant(merchantData) {
    try {
      const { businessName, mpesaShortcode, mpesaPhone, contactEmail } = merchantData;

      // Validate required fields
      if (!businessName || businessName.trim().length < 2) {
        throw new ValidationError('Business name is required and must be at least 2 characters');
      }

      if (mpesaPhone && !this.isValidPhoneNumber(mpesaPhone)) {
        throw new ValidationError('Invalid M-PESA phone number format');
      }

      if (contactEmail && !this.isValidEmail(contactEmail)) {
        throw new ValidationError('Invalid email format');
      }

      // Generate API key
      const apiKey = this.generateApiKey();

      const query = `
        INSERT INTO merchants (business_name, mpesa_shortcode, mpesa_phone, contact_email, api_key, verification_status, created_at)
        VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_TIMESTAMP)
        RETURNING id, business_name, mpesa_shortcode, mpesa_phone, contact_email, verification_status, created_at
      `;

      const result = await this.pool.query(query, [
        businessName,
        mpesaShortcode,
        mpesaPhone,
        contactEmail,
        apiKey
      ]);
      
      logger.info('Merchant created successfully', { merchantId: result.rows[0].id });
      return { ...result.rows[0], apiKey };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Error creating merchant', { error: error.message });
      throw new DatabaseError('Failed to create merchant', error);
    }
  }

  async updateMerchant(merchantId, updates) {
    try {
      const allowedFields = ['business_name', 'mpesa_shortcode', 'mpesa_phone', 'contact_email'];
      const validUpdates = {};
      
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key) && value !== undefined) {
          validUpdates[key] = value;
        }
      }

      if (Object.keys(validUpdates).length === 0) {
        throw new ValidationError('No valid fields to update');
      }

      const setClause = Object.keys(validUpdates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');

      const query = `
        UPDATE merchants 
        SET ${setClause}
        WHERE id = $1
        RETURNING id, business_name, mpesa_shortcode, mpesa_phone, contact_email, verification_status, updated_at
      `;

      const values = [merchantId, ...Object.values(validUpdates)];
      const result = await this.pool.query(query, values);

      if (!result.rows[0]) {
        throw new NotFoundError('Merchant not found');
      }

      logger.info('Merchant updated successfully', { merchantId });
      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error updating merchant', { error: error.message, merchantId });
      throw new DatabaseError('Failed to update merchant', error);
    }
  }

  async verifyMerchant(merchantId) {
    try {
      const query = `
        UPDATE merchants 
        SET verification_status = 'verified', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, business_name, verification_status, updated_at
      `;

      const result = await this.pool.query(query, [merchantId]);

      if (!result.rows[0]) {
        throw new NotFoundError('Merchant not found');
      }

      logger.info('Merchant verified successfully', { merchantId });
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error verifying merchant', { error: error.message, merchantId });
      throw new DatabaseError('Failed to verify merchant', error);
    }
  }

  generateApiKey() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }

  isValidPhoneNumber(phoneNumber) {
    // Kenyan phone number format: 254XXXXXXXXX
    const phoneRegex = /^254[17]\d{8}$/;
    return phoneRegex.test(phoneNumber);
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = new MerchantService();
