const { createInvoice, payViaPaymentRequest } = require('ln-service');
const { ValidationError, LightningError } = require('../utils/errors');
const logger = require('../utils/logger');

class LightningController {
  constructor(lndService) {
    this.lndService = lndService;
  }

  /**
   * Generate a Lightning invoice
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async generateInvoice(req, res, next) {
    try {
      const { amount, memo } = this.validateInvoiceRequest(req.body);
      
      const invoice = await this.lndService.createInvoice({
        tokens: amount,
        description: memo
      });

      logger.info('Invoice generated successfully', { paymentHash: invoice.id });

      return res.json({
        paymentRequest: invoice.request,
        paymentHash: invoice.id,
        expiresAt: invoice.expires_at
      });
    } catch (error) {
      logger.error('Invoice generation failed', { error: error.message });
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Process a Lightning payment
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async payInvoice(req, res, next) {
    try {
      const { paymentRequest } = this.validatePaymentRequest(req.body);

      const payment = await this.lndService.payViaPaymentRequest({
        request: paymentRequest
      });

      logger.info('Payment processed successfully', { 
        paymentHash: payment.id,
        fee: payment.fee 
      });

      return res.json({
        success: true,
        paymentHash: payment.id,
        fee: payment.fee,
        preimage: payment.preimage
      });
    } catch (error) {
      logger.error('Payment processing failed', { error: error.message });
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }

  /**
   * Validate invoice request parameters
   * @param {Object} body - Request body
   * @returns {Object} Validated parameters
   */
  validateInvoiceRequest(body) {
    const { amount, memo } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      throw new ValidationError('Invalid amount provided');
    }

    if (!memo || typeof memo !== 'string' || memo.length > 1024) {
      throw new ValidationError('Invalid memo provided');
    }

    return { amount, memo };
  }

  /**
   * Validate payment request parameters
   * @param {Object} body - Request body
   * @returns {Object} Validated parameters
   */
  validatePaymentRequest(body) {
    const { paymentRequest } = body;

    if (!paymentRequest || typeof paymentRequest !== 'string' || 
        !paymentRequest.startsWith('ln')) {
      throw new ValidationError('Invalid Lightning payment request');
    }

    return { paymentRequest };
  }
}

module.exports = new LightningController(require('../services/lndService'));
