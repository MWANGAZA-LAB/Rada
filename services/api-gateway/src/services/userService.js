const { Pool } = require('pg');
const { ValidationError, NotFoundError, DatabaseError } = require('../utils/errors');
const logger = require('../utils/logger');

class UserService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  async createUser({ phoneNumber, email }) {
    try {
      // Validate input
      if (!phoneNumber || !this.isValidPhoneNumber(phoneNumber)) {
        throw new ValidationError('Invalid phone number format');
      }

      if (email && !this.isValidEmail(email)) {
        throw new ValidationError('Invalid email format');
      }

      // Check if user already exists
      const existingUser = await this.findByPhone(phoneNumber);
      if (existingUser) {
        throw new ValidationError('User with this phone number already exists');
      }

      const query = `
        INSERT INTO users (phone_number, email, created_at, updated_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, phone_number, email, created_at
      `;

      const result = await this.pool.query(query, [phoneNumber, email]);
      
      logger.info('User created successfully', { userId: result.rows[0].id });
      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      logger.error('Error creating user', { error: error.message, phoneNumber });
      throw new DatabaseError('Failed to create user', error);
    }
  }

  async findByPhone(phoneNumber) {
    try {
      const query = `
        SELECT id, phone_number, email, created_at, updated_at
        FROM users 
        WHERE phone_number = $1 AND is_active = true
      `;
      
      const result = await this.pool.query(query, [phoneNumber]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by phone', { error: error.message, phoneNumber });
      throw new DatabaseError('Failed to find user', error);
    }
  }

  async findById(userId) {
    try {
      const query = `
        SELECT id, phone_number, email, created_at, updated_at
        FROM users 
        WHERE id = $1 AND is_active = true
      `;
      
      const result = await this.pool.query(query, [userId]);
      
      if (!result.rows[0]) {
        throw new NotFoundError('User not found');
      }
      
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error finding user by ID', { error: error.message, userId });
      throw new DatabaseError('Failed to find user', error);
    }
  }

  async updateUser(userId, updates) {
    try {
      const allowedFields = ['email', 'lightning_address', 'wallet_type'];
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
        UPDATE users 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND is_active = true
        RETURNING id, phone_number, email, lightning_address, wallet_type, updated_at
      `;

      const values = [userId, ...Object.values(validUpdates)];
      const result = await this.pool.query(query, values);

      if (!result.rows[0]) {
        throw new NotFoundError('User not found');
      }

      logger.info('User updated successfully', { userId });
      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Error updating user', { error: error.message, userId });
      throw new DatabaseError('Failed to update user', error);
    }
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

module.exports = new UserService();
