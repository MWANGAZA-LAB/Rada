const { Transaction } = require('../models');
const { LightningService } = require('../services/lightning');
const { MPESAService } = require('../services/mpesa');
const { PaymentError } = require('../utils/errors');
const logger = require('../utils/logger');
const { getRedisLock } = require('../utils/lock');

class PaymentProcessor {
  constructor() {
    this.lightningService = new LightningService();
    this.mpesaService = new MPESAService();
  }

  async processPayment(paymentDetails) {
    const { userId, amount, phone, merchantId } = paymentDetails;
    const lockKey = `payment:${userId}:${Date.now()}`;
    const lock = await getRedisLock();

    try {
      // Acquire lock for atomic operation
      await lock.acquire(lockKey, 30000); // 30 second timeout

      // 1. Create transaction record in PENDING state
      const transaction = await Transaction.create({
        userId,
        merchantId,
        amount,
        status: 'PENDING',
        phone
      });

      try {
        // 2. Generate Lightning invoice
        const invoice = await this.lightningService.generateInvoice({
          amount,
          memo: `Payment to ${merchantId}`,
          expiry: 3600 // 1 hour
        });

        // 3. Update transaction with invoice details
        await transaction.update({
          lightningInvoice: invoice.paymentRequest,
          paymentHash: invoice.paymentHash
        });

        // 4. Initiate M-PESA STK Push
        const stkResult = await this.mpesaService.initiateSTKPush({
          phone,
          amount,
          accountReference: transaction.id
        });

        // 5. Update transaction with M-PESA details
        await transaction.update({
          mpesaCheckoutRequestId: stkResult.CheckoutRequestID,
          status: 'PROCESSING'
        });

        logger.info('Payment initiated successfully', {
          transactionId: transaction.id,
          paymentHash: invoice.paymentHash
        });

        return {
          success: true,
          transactionId: transaction.id,
          checkoutRequestId: stkResult.CheckoutRequestID,
          paymentRequest: invoice.paymentRequest
        };

      } catch (error) {
        // If any step fails, mark transaction as failed
        await transaction.update({
          status: 'FAILED',
          errorMessage: error.message
        });

        logger.error('Payment processing failed', {
          transactionId: transaction.id,
          error: error.message
        });

        throw new PaymentError('Payment processing failed', error);
      }

    } finally {
      // Always release the lock
      await lock.release(lockKey);
    }
  }

  async handleMPESACallback(callbackData) {
    const { ResultCode, CheckoutRequestID, ResultDesc } = callbackData;
    
    const transaction = await Transaction.findOne({
      where: { mpesaCheckoutRequestId: CheckoutRequestID }
    });

    if (!transaction) {
      logger.error('Transaction not found for callback', { CheckoutRequestID });
      return;
    }

    try {
      if (ResultCode === 0) {
        // Payment successful
        await this.lightningService.payInvoice(transaction.lightningInvoice);
        
        await transaction.update({
          status: 'COMPLETED',
          completedAt: new Date()
        });

        logger.info('Payment completed successfully', {
          transactionId: transaction.id
        });
      } else {
        // Payment failed
        await transaction.update({
          status: 'FAILED',
          errorMessage: ResultDesc
        });

        logger.error('M-PESA payment failed', {
          transactionId: transaction.id,
          error: ResultDesc
        });
      }
    } catch (error) {
      logger.error('Error processing M-PESA callback', {
        transactionId: transaction.id,
        error: error.message
      });
      
      await transaction.update({
        status: 'FAILED',
        errorMessage: error.message
      });
    }
  }
}

module.exports = new PaymentProcessor();
