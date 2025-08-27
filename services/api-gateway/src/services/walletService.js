const { Pool } = require('pg');
const { ValidationError, NotFoundError, DatabaseError } = require('../utils/errors');
const logger = require('../utils/logger');
const cache = require('./cache');

class WalletService {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  /**
   * Create a new wallet for a user
   */
  async createWallet(userId, walletData = {}) {
    const { walletType = 'phoenix', lightningAddress } = walletData;

    try {
      // Validate user exists
      const userResult = await this.pool.query(
        'SELECT id, phone_number FROM users WHERE id = $1 AND is_active = true',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new NotFoundError('User not found or inactive');
      }

      // Check if wallet already exists
      const existingWallet = await this.pool.query(
        'SELECT id FROM wallets WHERE user_id = $1',
        [userId]
      );

      if (existingWallet.rows.length > 0) {
        throw new ValidationError('User already has a wallet');
      }

      // Validate wallet type
      const validWalletTypes = ['phoenix', 'breez', 'muun'];
      if (!validWalletTypes.includes(walletType)) {
        throw new ValidationError('Invalid wallet type');
      }

      // Create wallet
      const result = await this.pool.query(
        `INSERT INTO wallets (
          user_id, wallet_type, lightning_address, balance, 
          confirmed_balance, unconfirmed_balance, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        RETURNING *`,
        [userId, walletType, lightningAddress, 0, 0, 0]
      );

      const wallet = result.rows[0];

      // Update user with wallet info
      await this.pool.query(
        'UPDATE users SET wallet_type = $1, lightning_address = $2 WHERE id = $3',
        [walletType, lightningAddress, userId]
      );

      logger.info('Wallet created successfully', {
        walletId: wallet.id,
        userId,
        walletType,
        lightningAddress
      });

      return {
        id: wallet.id,
        userId: wallet.user_id,
        walletType: wallet.wallet_type,
        lightningAddress: wallet.lightning_address,
        balance: wallet.balance,
        confirmedBalance: wallet.confirmed_balance,
        unconfirmedBalance: wallet.unconfirmed_balance,
        createdAt: wallet.created_at
      };

    } catch (error) {
      logger.error('Error creating wallet', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get wallet balance with caching
   */
  async getWalletBalance(userId) {
    try {
      // Try to get from cache first
      const cachedBalance = await cache.get(`user_balance:${userId}`);
      if (cachedBalance) {
        return JSON.parse(cachedBalance);
      }

      // Get from database
      const result = await this.pool.query(
        `SELECT 
          w.*,
          u.phone_number,
          u.email
        FROM wallets w
        JOIN users u ON w.user_id = u.id
        WHERE w.user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Wallet not found');
      }

      const wallet = result.rows[0];
      const balanceData = {
        id: wallet.id,
        userId: wallet.user_id,
        walletType: wallet.wallet_type,
        lightningAddress: wallet.lightning_address,
        balance: parseFloat(wallet.balance || 0),
        confirmedBalance: parseFloat(wallet.confirmed_balance || 0),
        unconfirmedBalance: parseFloat(wallet.unconfirmed_balance || 0),
        totalBalance: parseFloat(wallet.balance || 0) + parseFloat(wallet.unconfirmed_balance || 0),
        userPhone: wallet.phone_number,
        userEmail: wallet.email,
        lastUpdated: wallet.updated_at,
        createdAt: wallet.created_at
      };

      // Cache for 5 minutes
      await cache.set(`user_balance:${userId}`, JSON.stringify(balanceData), 300);

      return balanceData;

    } catch (error) {
      logger.error('Error getting wallet balance', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update wallet balance
   */
  async updateWalletBalance(userId, balanceData) {
    const { balance, confirmedBalance, unconfirmedBalance } = balanceData;

    try {
      const result = await this.pool.query(
        `UPDATE wallets 
         SET 
           balance = COALESCE($1, balance),
           confirmed_balance = COALESCE($2, confirmed_balance),
           unconfirmed_balance = COALESCE($3, unconfirmed_balance),
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $4
         RETURNING *`,
        [balance, confirmedBalance, unconfirmedBalance, userId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Wallet not found');
      }

      const wallet = result.rows[0];

      // Invalidate cache
      await cache.del(`user_balance:${userId}`);

      logger.info('Wallet balance updated', {
        userId,
        balance: wallet.balance,
        confirmedBalance: wallet.confirmed_balance,
        unconfirmedBalance: wallet.unconfirmed_balance
      });

      return {
        id: wallet.id,
        userId: wallet.user_id,
        balance: parseFloat(wallet.balance || 0),
        confirmedBalance: parseFloat(wallet.confirmed_balance || 0),
        unconfirmedBalance: parseFloat(wallet.unconfirmed_balance || 0),
        totalBalance: parseFloat(wallet.balance || 0) + parseFloat(wallet.unconfirmed_balance || 0),
        updatedAt: wallet.updated_at
      };

    } catch (error) {
      logger.error('Error updating wallet balance', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Credit wallet balance
   */
  async creditWallet(userId, amount, metadata = {}) {
    if (amount <= 0) {
      throw new ValidationError('Credit amount must be greater than 0');
    }

    try {
      const result = await this.pool.query(
        `UPDATE wallets 
         SET 
           balance = balance + $1,
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2
         RETURNING *`,
        [amount, userId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Wallet not found');
      }

      const wallet = result.rows[0];

      // Invalidate cache
      await cache.del(`user_balance:${userId}`);

      // Log the credit operation
      await this.logBalanceOperation(userId, 'credit', amount, metadata);

      logger.info('Wallet credited', {
        userId,
        amount,
        newBalance: wallet.balance,
        metadata
      });

      return {
        id: wallet.id,
        userId: wallet.user_id,
        previousBalance: parseFloat(wallet.balance || 0) - amount,
        newBalance: parseFloat(wallet.balance || 0),
        amount: amount,
        operation: 'credit'
      };

    } catch (error) {
      logger.error('Error crediting wallet', { error: error.message, userId, amount });
      throw error;
    }
  }

  /**
   * Debit wallet balance
   */
  async debitWallet(userId, amount, metadata = {}) {
    if (amount <= 0) {
      throw new ValidationError('Debit amount must be greater than 0');
    }

    try {
      // Check if user has sufficient balance
      const currentBalance = await this.getWalletBalance(userId);
      if (currentBalance.balance < amount) {
        throw new ValidationError('Insufficient balance');
      }

      const result = await this.pool.query(
        `UPDATE wallets 
         SET 
           balance = balance - $1,
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $2
         RETURNING *`,
        [amount, userId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Wallet not found');
      }

      const wallet = result.rows[0];

      // Invalidate cache
      await cache.del(`user_balance:${userId}`);

      // Log the debit operation
      await this.logBalanceOperation(userId, 'debit', amount, metadata);

      logger.info('Wallet debited', {
        userId,
        amount,
        newBalance: wallet.balance,
        metadata
      });

      return {
        id: wallet.id,
        userId: wallet.user_id,
        previousBalance: parseFloat(wallet.balance || 0) + amount,
        newBalance: parseFloat(wallet.balance || 0),
        amount: amount,
        operation: 'debit'
      };

    } catch (error) {
      logger.error('Error debiting wallet', { error: error.message, userId, amount });
      throw error;
    }
  }

  /**
   * Get wallet by user ID
   */
  async getWalletByUserId(userId) {
    try {
      const result = await this.pool.query(
        `SELECT 
          w.*,
          u.phone_number,
          u.email,
          u.status as user_status
        FROM wallets w
        JOIN users u ON w.user_id = u.id
        WHERE w.user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Wallet not found');
      }

      const wallet = result.rows[0];

      return {
        id: wallet.id,
        userId: wallet.user_id,
        walletType: wallet.wallet_type,
        lightningAddress: wallet.lightning_address,
        balance: parseFloat(wallet.balance || 0),
        confirmedBalance: parseFloat(wallet.confirmed_balance || 0),
        unconfirmedBalance: parseFloat(wallet.unconfirmed_balance || 0),
        userPhone: wallet.phone_number,
        userEmail: wallet.email,
        userStatus: wallet.user_status,
        createdAt: wallet.created_at,
        updatedAt: wallet.updated_at
      };

    } catch (error) {
      logger.error('Error getting wallet by user ID', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get wallet by wallet ID
   */
  async getWalletById(walletId) {
    try {
      const result = await this.pool.query(
        `SELECT 
          w.*,
          u.phone_number,
          u.email,
          u.status as user_status
        FROM wallets w
        JOIN users u ON w.user_id = u.id
        WHERE w.id = $1`,
        [walletId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Wallet not found');
      }

      const wallet = result.rows[0];

      return {
        id: wallet.id,
        userId: wallet.user_id,
        walletType: wallet.wallet_type,
        lightningAddress: wallet.lightning_address,
        balance: parseFloat(wallet.balance || 0),
        confirmedBalance: parseFloat(wallet.confirmed_balance || 0),
        unconfirmedBalance: parseFloat(wallet.unconfirmed_balance || 0),
        userPhone: wallet.phone_number,
        userEmail: wallet.email,
        userStatus: wallet.user_status,
        createdAt: wallet.created_at,
        updatedAt: wallet.updated_at
      };

    } catch (error) {
      logger.error('Error getting wallet by ID', { error: error.message, walletId });
      throw error;
    }
  }

  /**
   * Update wallet settings
   */
  async updateWalletSettings(userId, settings) {
    const { walletType, lightningAddress } = settings;

    try {
      // Validate wallet type if provided
      if (walletType) {
        const validWalletTypes = ['phoenix', 'breez', 'muun'];
        if (!validWalletTypes.includes(walletType)) {
          throw new ValidationError('Invalid wallet type');
        }
      }

      const result = await this.pool.query(
        `UPDATE wallets 
         SET 
           wallet_type = COALESCE($1, wallet_type),
           lightning_address = COALESCE($2, lightning_address),
           updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3
         RETURNING *`,
        [walletType, lightningAddress, userId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Wallet not found');
      }

      const wallet = result.rows[0];

      // Update user record if lightning address changed
      if (lightningAddress) {
        await this.pool.query(
          'UPDATE users SET lightning_address = $1 WHERE id = $2',
          [lightningAddress, userId]
        );
      }

      // Invalidate cache
      await cache.del(`user_balance:${userId}`);

      logger.info('Wallet settings updated', {
        userId,
        walletType: wallet.wallet_type,
        lightningAddress: wallet.lightning_address
      });

      return {
        id: wallet.id,
        userId: wallet.user_id,
        walletType: wallet.wallet_type,
        lightningAddress: wallet.lightning_address,
        updatedAt: wallet.updated_at
      };

    } catch (error) {
      logger.error('Error updating wallet settings', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get wallet transaction history
   */
  async getWalletTransactions(userId, options = {}) {
    const { page = 1, limit = 20, type } = options;
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

      if (type) {
        query += ` AND t.type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.pool.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM transactions WHERE user_id = $1';
      const countParams = [userId];

      if (type) {
        countQuery += ' AND type = $2';
        countParams.push(type);
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
      logger.error('Error getting wallet transactions', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Log balance operation for audit trail
   */
  async logBalanceOperation(userId, operation, amount, metadata = {}) {
    try {
      await this.pool.query(
        `INSERT INTO audit_logs (
          user_id, action, details, ip_address, user_agent, created_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [
          userId,
          `wallet_${operation}`,
          JSON.stringify({
            amount,
            operation,
            timestamp: new Date().toISOString(),
            ...metadata
          }),
          metadata.ipAddress || null,
          metadata.userAgent || null
        ]
      );
    } catch (error) {
      logger.error('Error logging balance operation', { error: error.message, userId });
      // Don't throw error for audit logging failures
    }
  }

  /**
   * Get wallet statistics
   */
  async getWalletStats(userId, period = '30d') {
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
          COUNT(CASE WHEN type = 'credit' THEN 1 END) as credit_transactions,
          COUNT(CASE WHEN type = 'debit' THEN 1 END) as debit_transactions,
          SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as total_credits,
          SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) as total_debits,
          AVG(amount) as avg_transaction_amount
        FROM transactions 
        WHERE user_id = $1 AND ${dateFilter}`,
        [userId]
      );

      return result.rows[0];

    } catch (error) {
      logger.error('Error getting wallet stats', { error: error.message, userId });
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

module.exports = new WalletService();
