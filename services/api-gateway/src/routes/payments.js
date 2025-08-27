const { Router } = require('express');
const { authenticateUser } = require('../middleware/auth');
const { validateRequest, validateParams, validateQuery } = require('../middleware/validation');
const PaymentService = require('../services/paymentService');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

const router = Router();

/**
 * @route POST /api/v1/payments
 * @desc Create a new payment transaction
 * @access Private
 */
router.post('/',
  authenticateUser,
  validateRequest('createPayment'),
  async (req, res, next) => {
    try {
      const { amount, currency, paymentMethod, merchantId, description, metadata } = req.validatedData;
      const userId = req.user.userId;

      const paymentData = {
        userId,
        amount,
        currency,
        paymentMethod,
        merchantId,
        description,
        metadata,
        // Add payment method specific data
        ...(paymentMethod === 'mpesa' && { phoneNumber: req.body.phoneNumber }),
        ...(paymentMethod === 'bitcoin' && { walletAddress: req.body.walletAddress }),
        ...(paymentMethod === 'lightning' && { lightningInvoice: req.body.lightningInvoice })
      };

      const result = await PaymentService.createPayment(paymentData);

      logger.info('Payment created successfully', {
        transactionId: result.transaction.id,
        userId,
        amount,
        paymentMethod
      });

      return ResponseHandler.success(res, result, 'Payment transaction created successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/payments
 * @desc Get user's payment transactions with pagination
 * @access Private
 */
router.get('/',
  authenticateUser,
  validateQuery('getPayments'),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { page, limit, status, paymentMethod } = req.validatedData;

      const result = await PaymentService.getUserTransactions(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        paymentMethod
      });

      return ResponseHandler.paginated(res, result.transactions, result.pagination, 'Transactions retrieved successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/payments/:transactionId
 * @desc Get specific transaction details
 * @access Private
 */
router.get('/:transactionId',
  authenticateUser,
  validateParams('transactionId'),
  async (req, res, next) => {
    try {
      const { transactionId } = req.validatedData;
      const userId = req.user.userId;

      const transaction = await PaymentService.getTransaction(transactionId);

      // Ensure user can only access their own transactions
      if (transaction.user_id !== userId) {
        return ResponseHandler.forbidden(res, 'Access denied');
      }

      return ResponseHandler.success(res, transaction, 'Transaction details retrieved successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route PUT /api/v1/payments/:transactionId/status
 * @desc Update transaction status (admin/merchant only)
 * @access Private
 */
router.put('/:transactionId/status',
  authenticateUser,
  validateParams('transactionId'),
  validateRequest('updateTransactionStatus'),
  async (req, res, next) => {
    try {
      const { transactionId } = req.validatedData;
      const { status, metadata } = req.validatedData;
      const userId = req.user.userId;

      // Get transaction to check ownership
      const transaction = await PaymentService.getTransaction(transactionId);

      // Only allow updates if user owns the transaction or is a merchant
      if (transaction.user_id !== userId && !req.user.isMerchant) {
        return ResponseHandler.forbidden(res, 'Access denied');
      }

      const updatedTransaction = await PaymentService.updateTransactionStatus(
        transactionId,
        status,
        metadata
      );

      logger.info('Transaction status updated', {
        transactionId,
        status,
        updatedBy: userId
      });

      return ResponseHandler.success(res, updatedTransaction, 'Transaction status updated successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/payments/stats
 * @desc Get payment statistics for user
 * @access Private
 */
router.get('/stats',
  authenticateUser,
  validateQuery('getPaymentStats'),
  async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { period } = req.validatedData;

      const stats = await PaymentService.getTransactionStats(userId, period);

      return ResponseHandler.success(res, stats, 'Payment statistics retrieved successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/payments/:transactionId/cancel
 * @desc Cancel a pending transaction
 * @access Private
 */
router.post('/:transactionId/cancel',
  authenticateUser,
  validateParams('transactionId'),
  async (req, res, next) => {
    try {
      const { transactionId } = req.validatedData;
      const userId = req.user.userId;

      // Get transaction to check ownership and status
      const transaction = await PaymentService.getTransaction(transactionId);

      // Ensure user can only cancel their own transactions
      if (transaction.user_id !== userId) {
        return ResponseHandler.forbidden(res, 'Access denied');
      }

      // Only allow cancellation of pending transactions
      if (transaction.status !== 'pending') {
        return ResponseHandler.validationError(res, ['Transaction cannot be cancelled']);
      }

      const cancelledTransaction = await PaymentService.updateTransactionStatus(
        transactionId,
        'cancelled',
        { cancelledBy: userId, cancelledAt: new Date().toISOString() }
      );

      logger.info('Transaction cancelled', {
        transactionId,
        cancelledBy: userId
      });

      return ResponseHandler.success(res, cancelledTransaction, 'Transaction cancelled successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/payments/methods
 * @desc Get available payment methods
 * @access Public
 */
router.get('/methods',
  async (req, res, next) => {
    try {
      const paymentMethods = [
        {
          id: 'mpesa',
          name: 'M-Pesa',
          description: 'Mobile money payment via M-Pesa',
          icon: 'mobile',
          supportedCurrencies: ['KES'],
          minAmount: 10,
          maxAmount: 70000,
          processingTime: 'Instant',
          fees: {
            percentage: 0.01,
            fixed: 0
          }
        },
        {
          id: 'bitcoin',
          name: 'Bitcoin',
          description: 'Cryptocurrency payment via Bitcoin',
          icon: 'bitcoin',
          supportedCurrencies: ['BTC', 'USD', 'EUR'],
          minAmount: 0.00001,
          maxAmount: null,
          processingTime: '10-30 minutes',
          fees: {
            percentage: 0.005,
            fixed: 0
          }
        },
        {
          id: 'lightning',
          name: 'Lightning Network',
          description: 'Fast Bitcoin payments via Lightning Network',
          icon: 'lightning',
          supportedCurrencies: ['BTC', 'USD', 'EUR'],
          minAmount: 0.000001,
          maxAmount: 0.042,
          processingTime: 'Instant',
          fees: {
            percentage: 0.001,
            fixed: 0
          }
        }
      ];

      return ResponseHandler.success(res, paymentMethods, 'Payment methods retrieved successfully');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/payments/validate
 * @desc Validate payment data before processing
 * @access Private
 */
router.post('/validate',
  authenticateUser,
  validateRequest('validatePayment'),
  async (req, res, next) => {
    try {
      const { amount, currency, paymentMethod } = req.validatedData;
      const userId = req.user.userId;

      // Validate payment method specific requirements
      const validationErrors = [];

      if (paymentMethod === 'mpesa') {
        if (!req.body.phoneNumber) {
          validationErrors.push('Phone number is required for M-Pesa payments');
        }
      } else if (paymentMethod === 'bitcoin') {
        if (!req.body.walletAddress) {
          validationErrors.push('Wallet address is required for Bitcoin payments');
        }
      } else if (paymentMethod === 'lightning') {
        if (!req.body.lightningInvoice) {
          validationErrors.push('Lightning invoice is required for Lightning payments');
        }
      }

      if (validationErrors.length > 0) {
        return ResponseHandler.validationError(res, validationErrors);
      }

      // Check user balance for debit operations
      if (req.body.operation === 'debit') {
        // This would require wallet service integration
        // For now, just return success
      }

      return ResponseHandler.success(res, {
        isValid: true,
        estimatedFees: calculateFees(amount, paymentMethod),
        processingTime: getProcessingTime(paymentMethod)
      }, 'Payment validation successful');

    } catch (error) {
      next(error);
    }
  }
);

/**
 * Helper function to calculate fees
 */
function calculateFees(amount, paymentMethod) {
  const feeRates = {
    mpesa: { percentage: 0.01, fixed: 0 },
    bitcoin: { percentage: 0.005, fixed: 0 },
    lightning: { percentage: 0.001, fixed: 0 }
  };

  const rate = feeRates[paymentMethod] || feeRates.mpesa;
  return (amount * rate.percentage) + rate.fixed;
}

/**
 * Helper function to get processing time
 */
function getProcessingTime(paymentMethod) {
  const processingTimes = {
    mpesa: 'Instant',
    bitcoin: '10-30 minutes',
    lightning: 'Instant'
  };

  return processingTimes[paymentMethod] || 'Unknown';
}

module.exports = router;
