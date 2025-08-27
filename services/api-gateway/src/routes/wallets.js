const { Router } = require('express');
const { authenticateUser } = require('../middleware/auth');
const { validateRequest, validateParams, validateQuery } = require('../middleware/validation');
const WalletService = require('../services/walletService');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

const router = Router();

/**
 * @route POST /api/v1/wallets
 * @desc Create a new wallet for the authenticated user
 * @access Private
 */
router.post('/',
  authenticateUser,
  validateRequest('createWallet'),
  async (req, res, next) => {
    try {
      const { walletType, lightningAddress } = req.validatedData;
      const userId = req.user.userId;

      const walletData = {
        walletType,
        lightningAddress
      };

      const wallet = await WalletService.createWallet(userId, walletData);

      logger.info('Wallet created successfully', {
        walletId: wallet.id,
        userId,
        walletType
      });

      return ResponseHandler.success(res, wallet, 'Wallet created successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/wallets/balance
 * @desc Get current wallet balance
 * @access Private
 */
router.get('/balance',
  authenticateUser,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;

      const balance = await WalletService.getWalletBalance(userId);

      return ResponseHandler.success(res, balance, 'Wallet balance retrieved successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/wallets
 * @desc Get wallet details
 * @access Private
 */
router.get('/',
  authenticateUser,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;

      const wallet = await WalletService.getWalletByUserId(userId);

      return ResponseHandler.success(res, wallet, 'Wallet details retrieved successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PUT /api/v1/wallets
 * @desc Update wallet settings
 * @access Private
 */
router.put('/',
  authenticateUser,
  validateRequest('updateWallet'),
  async (req, res, next) => {
    try {
      const { walletType, lightningAddress } = req.validatedData;
      const userId = req.user.userId;

      const settings = {
        walletType,
        lightningAddress
      };

      const updatedWallet = await WalletService.updateWalletSettings(userId, settings);

      logger.info('Wallet settings updated', {
        userId,
        walletType: updatedWallet.walletType,
        lightningAddress: updatedWallet.lightningAddress
      });

      return ResponseHandler.success(res, updatedWallet, 'Wallet settings updated successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/wallets/transactions
 * @desc Get wallet transaction history with pagination
 * @access Private
 */
router.get('/transactions',
  authenticateUser,
  validateQuery('getWalletTransactions'),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { page, limit, type } = req.validatedData;

      const result = await WalletService.getWalletTransactions(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        type
      });

      return ResponseHandler.paginated(res, result.transactions, result.pagination, 'Wallet transactions retrieved successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/wallets/stats
 * @desc Get wallet statistics
 * @access Private
 */
router.get('/stats',
  authenticateUser,
  validateQuery('getWalletStats'),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { period } = req.validatedData;

      const stats = await WalletService.getWalletStats(userId, period);

      return ResponseHandler.success(res, stats, 'Wallet statistics retrieved successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/wallets/credit
 * @desc Credit wallet balance (for testing/admin purposes)
 * @access Private
 */
router.post('/credit',
  authenticateUser,
  validateRequest('creditWallet'),
  async (req, res, next) => {
    try {
      const { amount, metadata } = req.validatedData;
      const userId = req.user.userId;

      const result = await WalletService.creditWallet(userId, amount, {
        ...metadata,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      logger.info('Wallet credited', {
        userId,
        amount,
        newBalance: result.newBalance
      });

      return ResponseHandler.success(res, result, 'Wallet credited successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/wallets/debit
 * @desc Debit wallet balance
 * @access Private
 */
router.post('/debit',
  authenticateUser,
  validateRequest('debitWallet'),
  async (req, res, next) => {
    try {
      const { amount, metadata } = req.validatedData;
      const userId = req.user.userId;

      const result = await WalletService.debitWallet(userId, amount, {
        ...metadata,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      logger.info('Wallet debited', {
        userId,
        amount,
        newBalance: result.newBalance
      });

      return ResponseHandler.success(res, result, 'Wallet debited successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/wallets/:walletId
 * @desc Get wallet by ID (admin/merchant access)
 * @access Private
 */
router.get('/:walletId',
  authenticateUser,
  validateParams('walletId'),
  async (req, res, next) => {
    try {
      const { walletId } = req.validatedData;
      const userId = req.user.userId;

      const wallet = await WalletService.getWalletById(walletId);

      // Ensure user can only access their own wallet or has admin/merchant privileges
      if (wallet.userId !== userId && !req.user.isMerchant && !req.user.isAdmin) {
        return ResponseHandler.forbidden(res, 'Access denied');
      }

      return ResponseHandler.success(res, wallet, 'Wallet details retrieved successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/wallets/balance/refresh
 * @desc Force refresh wallet balance from blockchain
 * @access Private
 */
router.get('/balance/refresh',
  authenticateUser,
  async (req, res, next) => {
    try {
      const userId = req.user.userId;

      // This would typically integrate with blockchain APIs
      // For now, we'll just return the current balance
      const balance = await WalletService.getWalletBalance(userId);

      logger.info('Wallet balance refreshed', {
        userId,
        balance: balance.balance
      });

      return ResponseHandler.success(res, balance, 'Wallet balance refreshed successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/wallets/supported-types
 * @desc Get supported wallet types
 * @access Public
 */
router.get('/supported-types',
  async (req, res, next) => {
    try {
      const walletTypes = [
        {
          id: 'phoenix',
          name: 'Phoenix Wallet',
          description: 'Lightning wallet for Bitcoin payments',
          features: ['Lightning Network', 'Bitcoin', 'Instant Payments'],
          icon: 'phoenix',
          website: 'https://phoenix.acinq.co/',
          supportedNetworks: ['Bitcoin', 'Lightning']
        },
        {
          id: 'breez',
          name: 'Breez Wallet',
          description: 'Non-custodial Lightning wallet',
          features: ['Lightning Network', 'Bitcoin', 'Non-custodial'],
          icon: 'breez',
          website: 'https://breez.technology/',
          supportedNetworks: ['Bitcoin', 'Lightning']
        },
        {
          id: 'muun',
          name: 'Muun Wallet',
          description: 'Bitcoin and Lightning wallet',
          features: ['Bitcoin', 'Lightning Network', 'Multi-sig'],
          icon: 'muun',
          website: 'https://muun.com/',
          supportedNetworks: ['Bitcoin', 'Lightning']
        }
      ];

      return ResponseHandler.success(res, walletTypes, 'Supported wallet types retrieved successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/wallets/validate-address
 * @desc Validate Lightning address format
 * @access Private
 */
router.post('/validate-address',
  authenticateUser,
  validateRequest('validateLightningAddress'),
  async (req, res, next) => {
    try {
      const { lightningAddress } = req.validatedData;

      // Basic Lightning address validation
      const isValid = validateLightningAddress(lightningAddress);

      return ResponseHandler.success(res, {
        isValid,
        address: lightningAddress,
        message: isValid ? 'Valid Lightning address' : 'Invalid Lightning address format'
      }, 'Address validation completed');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * Helper function to validate Lightning address format
 */
function validateLightningAddress(address) {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Basic Lightning address format: username@domain
  const lightningAddressRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return lightningAddressRegex.test(address);
}

module.exports = router;
