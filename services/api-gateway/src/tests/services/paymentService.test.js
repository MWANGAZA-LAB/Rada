const PaymentService = require('../../services/paymentService');
const { ValidationError, NotFoundError, PaymentError, DatabaseError } = require('../../utils/errors');

// Mock dependencies
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    end: jest.fn()
  }))
}));

jest.mock('../../services/cache', () => ({
  del: jest.fn().mockResolvedValue(1)
}));

describe('PaymentService', () => {
  let paymentService;
  let mockPool;

  beforeEach(() => {
    paymentService = PaymentService;
    mockPool = paymentService.pool;
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    const validPaymentData = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      amount: 1000,
      currency: 'KES',
      paymentMethod: 'mpesa',
      description: 'Test payment'
    };

    it('should create a payment successfully', async () => {
      // Mock user exists
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: validPaymentData.userId, phone_number: '254700000000' }]
        })
        // Mock transaction creation
        .mockResolvedValueOnce({
          rows: [{
            id: 'txn-123',
            transaction_ref: 'TXN-ABC123',
            amount: 1000,
            currency: 'KES',
            payment_method: 'mpesa',
            status: 'pending',
            created_at: new Date()
          }]
        })
        // Mock M-Pesa payment creation
        .mockResolvedValueOnce({
          rows: [{
            id: 'mpesa-123',
            transaction_id: 'txn-123',
            phone_number: '254700000000',
            amount: 1000,
            status: 'pending'
          }]
        });

      const result = await paymentService.createPayment(validPaymentData);

      expect(result.transaction).toBeDefined();
      expect(result.transaction.amount).toBe(1000);
      expect(result.transaction.paymentMethod).toBe('mpesa');
      expect(result.payment).toBeDefined();
    });

    it('should throw ValidationError for missing required fields', async () => {
      const invalidData = { amount: 1000 };

      await expect(paymentService.createPayment(invalidData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid payment method', async () => {
      const invalidData = {
        ...validPaymentData,
        paymentMethod: 'invalid'
      };

      await expect(paymentService.createPayment(invalidData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for negative amount', async () => {
      const invalidData = {
        ...validPaymentData,
        amount: -100
      };

      await expect(paymentService.createPayment(invalidData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent user', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(paymentService.createPayment(validPaymentData))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw NotFoundError for non-existent merchant', async () => {
      const dataWithMerchant = {
        ...validPaymentData,
        merchantId: 'merchant-123'
      };

      // Mock user exists
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: validPaymentData.userId, phone_number: '254700000000' }]
        })
        // Mock merchant not found
        .mockResolvedValueOnce({ rows: [] });

      await expect(paymentService.createPayment(dataWithMerchant))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('getTransaction', () => {
    it('should return transaction details', async () => {
      const transactionId = 'txn-123';
      const mockTransaction = {
        id: transactionId,
        user_id: 'user-123',
        amount: 1000,
        currency: 'KES',
        payment_method: 'mpesa',
        status: 'completed',
        user_phone: '254700000000',
        merchant_name: 'Test Merchant'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockTransaction]
      });

      const result = await paymentService.getTransaction(transactionId);

      expect(result).toEqual(mockTransaction);
    });

    it('should throw NotFoundError for non-existent transaction', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(paymentService.getTransaction('non-existent'))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('getUserTransactions', () => {
    it('should return paginated transactions', async () => {
      const userId = 'user-123';
      const mockTransactions = [
        { id: 'txn-1', amount: 1000, status: 'completed' },
        { id: 'txn-2', amount: 2000, status: 'pending' }
      ];

      mockPool.query
        .mockResolvedValueOnce({
          rows: mockTransactions
        })
        .mockResolvedValueOnce({
          rows: [{ count: '2' }]
        });

      const result = await paymentService.getUserTransactions(userId, {
        page: 1,
        limit: 20
      });

      expect(result.transactions).toEqual(mockTransactions);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by status', async () => {
      const userId = 'user-123';
      const mockTransactions = [
        { id: 'txn-1', amount: 1000, status: 'completed' }
      ];

      mockPool.query
        .mockResolvedValueOnce({
          rows: mockTransactions
        })
        .mockResolvedValueOnce({
          rows: [{ count: '1' }]
        });

      const result = await paymentService.getUserTransactions(userId, {
        page: 1,
        limit: 20,
        status: 'completed'
      });

      expect(result.transactions).toEqual(mockTransactions);
    });
  });

  describe('updateTransactionStatus', () => {
    it('should update transaction status successfully', async () => {
      const transactionId = 'txn-123';
      const newStatus = 'completed';
      const mockUpdatedTransaction = {
        id: transactionId,
        status: newStatus,
        user_id: 'user-123',
        amount: 1000
      };

      mockPool.query
        .mockResolvedValueOnce({
          rows: [mockUpdatedTransaction]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'wallet-123', balance: 1000 }]
        });

      const result = await paymentService.updateTransactionStatus(
        transactionId,
        newStatus
      );

      expect(result.status).toBe(newStatus);
    });

    it('should throw ValidationError for invalid status', async () => {
      await expect(paymentService.updateTransactionStatus('txn-123', 'invalid'))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent transaction', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(paymentService.updateTransactionStatus('non-existent', 'completed'))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('updateUserBalance', () => {
    it('should credit user balance', async () => {
      const userId = 'user-123';
      const amount = 1000;
      const operation = 'credit';

      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'wallet-123',
          user_id: userId,
          balance: 2000
        }]
      });

      const result = await paymentService.updateUserBalance(userId, amount, operation);

      expect(result.balance).toBe(2000);
    });

    it('should debit user balance', async () => {
      const userId = 'user-123';
      const amount = 500;
      const operation = 'debit';

      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'wallet-123',
          user_id: userId,
          balance: 500
        }]
      });

      const result = await paymentService.updateUserBalance(userId, amount, operation);

      expect(result.balance).toBe(500);
    });

    it('should throw NotFoundError for non-existent wallet', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(paymentService.updateUserBalance('non-existent', 1000, 'credit'))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('generateTransactionRef', () => {
    it('should generate unique transaction reference', () => {
      const ref1 = paymentService.generateTransactionRef();
      const ref2 = paymentService.generateTransactionRef();

      expect(ref1).toMatch(/^TXN-[a-zA-Z0-9]+-[a-zA-Z0-9]+$/);
      expect(ref2).toMatch(/^TXN-[a-zA-Z0-9]+-[a-zA-Z0-9]+$/);
      expect(ref1).not.toBe(ref2);
    });
  });

  describe('getTransactionStats', () => {
    it('should return transaction statistics for 30 days', async () => {
      const userId = 'user-123';
      const mockStats = {
        total_transactions: 10,
        completed_transactions: 8,
        failed_transactions: 2,
        total_amount: 15000,
        avg_amount: 1500
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockStats]
      });

      const result = await paymentService.getTransactionStats(userId, '30d');

      expect(result).toEqual(mockStats);
    });

    it('should return transaction statistics for 7 days', async () => {
      const userId = 'user-123';
      const mockStats = {
        total_transactions: 5,
        completed_transactions: 4,
        failed_transactions: 1,
        total_amount: 8000,
        avg_amount: 1600
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockStats]
      });

      const result = await paymentService.getTransactionStats(userId, '7d');

      expect(result).toEqual(mockStats);
    });
  });

  describe('createMpesaPayment', () => {
    it('should create M-Pesa payment record', async () => {
      const transactionId = 'txn-123';
      const paymentData = {
        phoneNumber: '254700000000',
        amount: 1000,
        description: 'M-Pesa payment'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'mpesa-123',
          transaction_id: transactionId,
          phone_number: paymentData.phoneNumber,
          amount: paymentData.amount,
          status: 'pending'
        }]
      });

      const result = await paymentService.createMpesaPayment(transactionId, paymentData);

      expect(result.phone_number).toBe(paymentData.phoneNumber);
      expect(result.amount).toBe(paymentData.amount);
    });

    it('should throw ValidationError for missing phone number', async () => {
      const transactionId = 'txn-123';
      const paymentData = {
        amount: 1000,
        description: 'M-Pesa payment'
      };

      await expect(paymentService.createMpesaPayment(transactionId, paymentData))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('createBitcoinPayment', () => {
    it('should create Bitcoin payment record', async () => {
      const transactionId = 'txn-123';
      const paymentData = {
        walletAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        amount: 0.001,
        description: 'Bitcoin payment'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'btc-123',
          transaction_id: transactionId,
          wallet_address: paymentData.walletAddress,
          amount: paymentData.amount,
          status: 'pending'
        }]
      });

      const result = await paymentService.createBitcoinPayment(transactionId, paymentData);

      expect(result.wallet_address).toBe(paymentData.walletAddress);
      expect(result.amount).toBe(paymentData.amount);
    });

    it('should throw ValidationError for missing wallet address', async () => {
      const transactionId = 'txn-123';
      const paymentData = {
        amount: 0.001,
        description: 'Bitcoin payment'
      };

      await expect(paymentService.createBitcoinPayment(transactionId, paymentData))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('createLightningPayment', () => {
    it('should create Lightning payment record', async () => {
      const transactionId = 'txn-123';
      const paymentData = {
        lightningInvoice: 'lnbc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        amount: 0.0001,
        description: 'Lightning payment'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'ln-123',
          transaction_id: transactionId,
          lightning_invoice: paymentData.lightningInvoice,
          amount: paymentData.amount,
          status: 'pending'
        }]
      });

      const result = await paymentService.createLightningPayment(transactionId, paymentData);

      expect(result.lightning_invoice).toBe(paymentData.lightningInvoice);
      expect(result.amount).toBe(paymentData.amount);
    });

    it('should throw ValidationError for missing lightning invoice', async () => {
      const transactionId = 'txn-123';
      const paymentData = {
        amount: 0.0001,
        description: 'Lightning payment'
      };

      await expect(paymentService.createLightningPayment(transactionId, paymentData))
        .rejects
        .toThrow(ValidationError);
    });
  });
});
