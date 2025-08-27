const { Pool } = require('pg');
const { ValidationError, NotFoundError, PaymentError, DatabaseError } = require('../utils/errors');
const logger = require('../utils/logger');
const cache = require('./cache');

class PaymentService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  /**
   * Create a new payment transaction
   */
  async createPayment(paymentData) {
    const { userId, amount, currency, paymentMethod, merchantId, description, metadata } = paymentData;
    
    try {
      // Validate required fields
      if (!userId || !amount || !currency || !paymentMethod) {
        throw new ValidationError('Missing required payment fields');
      }

      if (amount <= 0) {
        throw new ValidationError('Payment amount must be greater than 0');
      }

      // Validate payment method
      const validMethods = ['mpesa', 'bitcoin', 'lightning'];
      if (!validMethods.includes(paymentMethod)) {
        throw new ValidationError('Invalid payment method');
      }

      // Check if user exists and has sufficient balance
      const userResult = await this.pool.query(
        'SELECT id, phone_number FROM users WHERE id = $1 AND is_active = true',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new NotFoundError('User not found or inactive');
      }

      // Check merchant if provided
      if (merchantId) {
        const merchantResult = await this.pool.query(
          'SELECT id, name, is_active FROM merchants WHERE id = $1',
          [merchantId]
        );

        if (merchantResult.rows.length === 0) {
          throw new NotFoundError('Merchant not found');
        }

        if (!merchantResult.rows[0].is_active) {
          throw new ValidationError('Merchant is inactive');
        }
      }

      // Generate transaction reference
      const transactionRef = this.generateTransactionRef();

      // Create transaction record
      const transactionResult = await this.pool.query(
        `INSERT INTO transactions (
          user_id, amount, currency, payment_method, merchant_id, 
          description, transaction_ref, status, metadata, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        RETURNING *`,
        [userId, amount, currency, paymentMethod, merchantId, description, transactionRef, 'pending', metadata]
      );

      const transaction = transactionResult.rows[0];

      // Create specific payment record based on method
      let paymentRecord;
      switch (paymentMethod) {
        case 'mpesa':
          paymentRecord = await this.createMpesaPayment(transaction.id, paymentData);
          break;
        case 'bitcoin':
          paymentRecord = await this.createBitcoinPayment(transaction.id, paymentData);
          break;
        case 'lightning':
          paymentRecord = await this.createLightningPayment(transaction.id, paymentData);
          break;
      }

      // Invalidate user balance cache
      await cache.del(`user_balance:${userId}`);

      logger.info('Payment transaction created', {
        transactionId: transaction.id,
        userId,
        amount,
        paymentMethod,
        transactionRef
      });

      return {
        transaction: {
          id: transaction.id,
          transactionRef: transaction.transaction_ref,
          amount: transaction.amount,
          currency: transaction.currency,
          paymentMethod: transaction.payment_method,
          status: transaction.status,
          description: transaction.description,
          createdAt: transaction.created_at
        },
        payment: paymentRecord
      };

    } catch (error) {
      logger.error('Error creating payment', { error: error.message, userId, amount });
      throw error;
    }
  }

  /**
   * Create M-Pesa payment record
   */
  async createMpesaPayment(transactionId, paymentData) {
    const { phoneNumber, amount, description } = paymentData;

    if (!phoneNumber) {
      throw new ValidationError('Phone number is required for M-Pesa payments');
    }

    const result = await this.pool.query(
      `INSERT INTO mpesa_transactions (
        transaction_id, phone_number, amount, description, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING *`,
      [transactionId, phoneNumber, amount, description, 'pending']
    );

    return result.rows[0];
  }

  /**
   * Create Bitcoin payment record
   */
  async createBitcoinPayment(transactionId, paymentData) {
    const { walletAddress, amount, description } = paymentData;

    if (!walletAddress) {
      throw new ValidationError('Wallet address is required for Bitcoin payments');
    }

    const result = await this.pool.query(
      `INSERT INTO bitcoin_transactions (
        transaction_id, wallet_address, amount, description, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING *`,
      [transactionId, walletAddress, amount, description, 'pending']
    );

    return result.rows[0];
  }

  /**
   * Create Lightning payment record
   */
  async createLightningPayment(transactionId, paymentData) {
    const { lightningInvoice, amount, description } = paymentData;

    if (!lightningInvoice) {
      throw new ValidationError('Lightning invoice is required for Lightning payments');
    }

    const result = await this.pool.query(
      `INSERT INTO lightning_transactions (
        transaction_id, lightning_invoice, amount, description, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING *`,
      [transactionId, lightningInvoice, amount, description, 'pending']
    );

    return result.rows[0];
  }

  /**
   * Get transaction by ID
   */
  async getTransaction(transactionId) {
    try {
      const result = await this.pool.query(
        `SELECT 
          t.*,
          u.phone_number as user_phone,
          u.email as user_email,
          m.name as merchant_name,
          mt.phone_number as mpesa_phone,
          bt.wallet_address as bitcoin_address,
          lt.lightning_invoice
        FROM transactions t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN merchants m ON t.merchant_id = m.id
        LEFT JOIN mpesa_transactions mt ON t.id = mt.transaction_id
        LEFT JOIN bitcoin_transactions bt ON t.id = bt.transaction_id
        LEFT JOIN lightning_transactions lt ON t.id = lt.transaction_id
        WHERE t.id = $1`,
        [transactionId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Transaction not found');
      }

      return result.rows[0];

    } catch (error) {
      logger.error('Error getting transaction', { error: error.message, transactionId });
      throw error;
    }
  }

  /**
   * Get user transactions with pagination
   */
  async getUserTransactions(userId, options = {}) {
    const { page = 1, limit = 20, status, paymentMethod } = options;
    const offset = (page - 1) * limit;

    try {
      let query = `
        SELECT 
          t.*,
          m.name as merchant_name
        FROM transactions t
        LEFT JOIN merchants m ON t.merchant_id = m.id
        WHERE t.user_id = $1
      `;
      
      const params = [userId];
      let paramIndex = 2;

      if (status) {
        query += ` AND t.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (paymentMethod) {
        query += ` AND t.payment_method = $${paramIndex}`;
        params.push(paymentMethod);
        paramIndex++;
      }

      query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.pool.query(query, params);

      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) FROM transactions WHERE user_id = $1';
      const countParams = [userId];

      if (status) {
        countQuery += ' AND status = $2';
        countParams.push(status);
      }

      if (paymentMethod) {
        countQuery += ' AND payment_method = $3';
        countParams.push(paymentMethod);
      }

      const countResult = await this.pool.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);

      return {
        transactions: result.rows,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      };

    } catch (error) {
      logger.error('Error getting user transactions', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(transactionId, status, metadata = {}) {
    const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      throw new ValidationError('Invalid transaction status');
    }

    try {
      const result = await this.pool.query(
        `UPDATE transactions 
         SET status = $1, updated_at = CURRENT_TIMESTAMP, metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb
         WHERE id = $3
         RETURNING *`,
        [status, JSON.stringify(metadata), transactionId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Transaction not found');
      }

      const transaction = result.rows[0];

      // If transaction is completed, update user balance
      if (status === 'completed') {
        await this.updateUserBalance(transaction.user_id, transaction.amount, 'credit');
      }

      // Invalidate user balance cache
      await cache.del(`user_balance:${transaction.user_id}`);

      logger.info('Transaction status updated', {
        transactionId,
        status,
        userId: transaction.user_id
      });

      return transaction;

    } catch (error) {
      logger.error('Error updating transaction status', { error: error.message, transactionId, status });
      throw error;
    }
  }

  /**
   * Update user balance
   */
  async updateUserBalance(userId, amount, operation) {
    try {
      const result = await this.pool.query(
        `UPDATE wallets 
         SET balance = CASE 
           WHEN $2 = 'credit' THEN balance + $1
           WHEN $2 = 'debit' THEN balance - $1
           ELSE balance
         END,
         updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3
         RETURNING *`,
        [amount, operation, userId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('User wallet not found');
      }

      return result.rows[0];

    } catch (error) {
      logger.error('Error updating user balance', { error: error.message, userId, amount, operation });
      throw error;
    }
  }

  /**
   * Generate unique transaction reference
   */
  generateTransactionRef() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `TXN-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStats(userId, period = '30d') {
    try {
      let dateFilter;
      switch (period) {
        case '7d':
          dateFilter = 'created_at >= CURRENT_DATE - INTERVAL \'7 days\'';
          break;
        case '30d':
          dateFilter = 'created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
          break;
        case '90d':
          dateFilter = 'created_at >= CURRENT_DATE - INTERVAL \'90 days\'';
          break;
        default:
          dateFilter = 'created_at >= CURRENT_DATE - INTERVAL \'30 days\'';
      }

      const result = await this.pool.query(
        `SELECT 
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_amount,
          AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END) as avg_amount
        FROM transactions 
        WHERE user_id = $1 AND ${dateFilter}`,
        [userId]
      );

      return result.rows[0];

    } catch (error) {
      logger.error('Error getting transaction stats', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = new PaymentService();
