const { jest } = require('@jest/globals');
const PaymentProcessor = require('../../services/paymentProcessor');
const { LightningService } = require('../../services/lightning');
const { MPESAService } = require('../../services/mpesa');
const { Transaction } = require('../../models');
const { getRedisLock } = require('../../utils/lock');
const { PaymentError } = require('../../utils/errors');

// Mock dependencies
jest.mock('../../services/lightning');
jest.mock('../../services/mpesa');
jest.mock('../../models');
jest.mock('../../utils/lock');

describe('PaymentProcessor', () => {
  let paymentProcessor;
  let mockLightningService;
  let mockMPESAService;
  let mockLock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock implementations
    mockLock = {
      acquire: jest.fn().mockResolvedValue(true),
      release: jest.fn().mockResolvedValue(true)
    };
    getRedisLock.mockReturnValue(mockLock);

    mockLightningService = {
      generateInvoice: jest.fn().mockResolvedValue({
        paymentRequest: 'lnbc...',
        paymentHash: 'hash123'
      }),
      payInvoice: jest.fn().mockResolvedValue(true)
    };
    LightningService.mockImplementation(() => mockLightningService);

    mockMPESAService = {
      initiateSTKPush: jest.fn().mockResolvedValue({
        CheckoutRequestID: 'ws_123'
      })
    };
    MPESAService.mockImplementation(() => mockMPESAService);

    Transaction.create = jest.fn().mockResolvedValue({
      id: 'tx123',
      update: jest.fn().mockResolvedValue(true)
    });

    Transaction.findOne = jest.fn().mockResolvedValue({
      id: 'tx123',
      update: jest.fn().mockResolvedValue(true)
    });

    paymentProcessor = new PaymentProcessor();
  });

  describe('processPayment', () => {
    const validPaymentDetails = {
      userId: 'user123',
      amount: 1000,
      phone: '254712345678',
      merchantId: 'merchant123'
    };

    it('should successfully process a payment', async () => {
      const result = await paymentProcessor.processPayment(validPaymentDetails);

      expect(result).toEqual({
        success: true,
        transactionId: 'tx123',
        checkoutRequestId: 'ws_123',
        paymentRequest: 'lnbc...'
      });

      // Verify lock was acquired and released
      expect(mockLock.acquire).toHaveBeenCalled();
      expect(mockLock.release).toHaveBeenCalled();

      // Verify transaction was created
      expect(Transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: validPaymentDetails.userId,
          merchantId: validPaymentDetails.merchantId,
          status: 'PENDING'
        })
      );

      // Verify Lightning invoice was generated
      expect(mockLightningService.generateInvoice).toHaveBeenCalled();

      // Verify M-PESA STK push was initiated
      expect(mockMPESAService.initiateSTKPush).toHaveBeenCalled();
    });

    it('should handle Lightning service failures', async () => {
      mockLightningService.generateInvoice.mockRejectedValue(
        new Error('Lightning network error')
      );

      await expect(
        paymentProcessor.processPayment(validPaymentDetails)
      ).rejects.toThrow(PaymentError);

      const transaction = await Transaction.create.mock.results[0].value;
      expect(transaction.update).toHaveBeenCalledWith({
        status: 'FAILED',
        errorMessage: expect.any(String)
      });
    });

    it('should handle M-PESA service failures', async () => {
      mockMPESAService.initiateSTKPush.mockRejectedValue(
        new Error('M-PESA service error')
      );

      await expect(
        paymentProcessor.processPayment(validPaymentDetails)
      ).rejects.toThrow(PaymentError);

      const transaction = await Transaction.create.mock.results[0].value;
      expect(transaction.update).toHaveBeenCalledWith({
        status: 'FAILED',
        errorMessage: expect.any(String)
      });
    });

    it('should release lock even on failure', async () => {
      mockMPESAService.initiateSTKPush.mockRejectedValue(
        new Error('Test error')
      );

      await expect(
        paymentProcessor.processPayment(validPaymentDetails)
      ).rejects.toThrow();

      expect(mockLock.release).toHaveBeenCalled();
    });
  });

  describe('handleMPESACallback', () => {
    const successCallback = {
      ResultCode: 0,
      CheckoutRequestID: 'ws_123',
      ResultDesc: 'Success'
    };

    const failureCallback = {
      ResultCode: 1,
      CheckoutRequestID: 'ws_123',
      ResultDesc: 'Failed'
    };

    it('should handle successful M-PESA payment', async () => {
      await paymentProcessor.handleMPESACallback(successCallback);

      expect(mockLightningService.payInvoice).toHaveBeenCalled();
      expect(Transaction.findOne.mock.results[0].value.update)
        .toHaveBeenCalledWith({
          status: 'COMPLETED',
          completedAt: expect.any(Date)
        });
    });

    it('should handle failed M-PESA payment', async () => {
      await paymentProcessor.handleMPESACallback(failureCallback);

      expect(mockLightningService.payInvoice).not.toHaveBeenCalled();
      expect(Transaction.findOne.mock.results[0].value.update)
        .toHaveBeenCalledWith({
          status: 'FAILED',
          errorMessage: 'Failed'
        });
    });

    it('should handle non-existent transactions', async () => {
      Transaction.findOne.mockResolvedValueOnce(null);

      await paymentProcessor.handleMPESACallback(successCallback);

      expect(mockLightningService.payInvoice).not.toHaveBeenCalled();
    });
  });
});
