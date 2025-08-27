const WalletService = require('../../services/walletService');
const { ValidationError, NotFoundError, DatabaseError } = require('../../utils/errors');

// Mock dependencies
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    end: jest.fn()
  }))
}));

jest.mock('../../services/cache', () => ({
  get: jest.fn(),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1)
}));

describe('WalletService', () => {
  let walletService;
  let mockPool;
  let mockCache;

  beforeEach(() => {
    walletService = WalletService;
    mockPool = walletService.pool;
    mockCache = require('../../services/cache');
    jest.clearAllMocks();
  });

  describe('createWallet', () => {
    const validWalletData = {
      walletType: 'phoenix',
      lightningAddress: 'user@example.com'
    };

    it('should create a wallet successfully', async () => {
      const userId = 'user-123';

      // Mock user exists
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: userId, phone_number: '254700000000' }]
        })
        // Mock no existing wallet
        .mockResolvedValueOnce({ rows: [] })
        // Mock wallet creation
        .mockResolvedValueOnce({
          rows: [{
            id: 'wallet-123',
            user_id: userId,
            wallet_type: validWalletData.walletType,
            lightning_address: validWalletData.lightningAddress,
            balance: 0,
            confirmed_balance: 0,
            unconfirmed_balance: 0,
            created_at: new Date()
          }]
        })
        // Mock user update
        .mockResolvedValueOnce({ rows: [] });

      const result = await walletService.createWallet(userId, validWalletData);

      expect(result.id).toBe('wallet-123');
      expect(result.userId).toBe(userId);
      expect(result.walletType).toBe(validWalletData.walletType);
      expect(result.lightningAddress).toBe(validWalletData.lightningAddress);
    });

    it('should throw NotFoundError for non-existent user', async () => {
      const userId = 'user-123';
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(walletService.createWallet(userId, validWalletData))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should throw ValidationError if user already has a wallet', async () => {
      const userId = 'user-123';

      // Mock user exists
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: userId, phone_number: '254700000000' }]
        })
        // Mock existing wallet
        .mockResolvedValueOnce({
          rows: [{ id: 'existing-wallet' }]
        });

      await expect(walletService.createWallet(userId, validWalletData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid wallet type', async () => {
      const userId = 'user-123';
      const invalidData = {
        ...validWalletData,
        walletType: 'invalid'
      };

      // Mock user exists
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: userId, phone_number: '254700000000' }]
      });

      await expect(walletService.createWallet(userId, invalidData))
        .rejects
        .toThrow(ValidationError);
    });
  });

  describe('getWalletBalance', () => {
    it('should return cached balance if available', async () => {
      const userId = 'user-123';
      const cachedBalance = {
        id: 'wallet-123',
        userId: userId,
        balance: 1000,
        confirmedBalance: 1000,
        unconfirmedBalance: 0,
        totalBalance: 1000
      };

      mockCache.get.mockResolvedValue(JSON.stringify(cachedBalance));

      const result = await walletService.getWalletBalance(userId);

      expect(result).toEqual(cachedBalance);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not cached', async () => {
      const userId = 'user-123';
      const mockWallet = {
        id: 'wallet-123',
        user_id: userId,
        wallet_type: 'phoenix',
        lightning_address: 'user@example.com',
        balance: 1000,
        confirmed_balance: 1000,
        unconfirmed_balance: 0,
        phone_number: '254700000000',
        email: 'user@example.com',
        updated_at: new Date(),
        created_at: new Date()
      };

      mockCache.get.mockResolvedValue(null);
      mockPool.query.mockResolvedValueOnce({
        rows: [mockWallet]
      });

      const result = await walletService.getWalletBalance(userId);

      expect(result.balance).toBe(1000);
      expect(result.totalBalance).toBe(1000);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent wallet', async () => {
      const userId = 'user-123';

      mockCache.get.mockResolvedValue(null);
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(walletService.getWalletBalance(userId))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('updateWalletBalance', () => {
    it('should update wallet balance successfully', async () => {
      const userId = 'user-123';
      const balanceData = {
        balance: 2000,
        confirmedBalance: 1800,
        unconfirmedBalance: 200
      };

      const mockUpdatedWallet = {
        id: 'wallet-123',
        user_id: userId,
        balance: balanceData.balance,
        confirmed_balance: balanceData.confirmedBalance,
        unconfirmed_balance: balanceData.unconfirmedBalance,
        updated_at: new Date()
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockUpdatedWallet]
      });

      const result = await walletService.updateWalletBalance(userId, balanceData);

      expect(result.balance).toBe(balanceData.balance);
      expect(result.confirmedBalance).toBe(balanceData.confirmedBalance);
      expect(result.unconfirmedBalance).toBe(balanceData.unconfirmedBalance);
      expect(mockCache.del).toHaveBeenCalledWith(`user_balance:${userId}`);
    });

    it('should throw NotFoundError for non-existent wallet', async () => {
      const userId = 'user-123';
      const balanceData = { balance: 2000 };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(walletService.updateWalletBalance(userId, balanceData))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('creditWallet', () => {
    it('should credit wallet balance successfully', async () => {
      const userId = 'user-123';
      const amount = 1000;
      const metadata = { source: 'payment' };

      const mockUpdatedWallet = {
        id: 'wallet-123',
        user_id: userId,
        balance: 2000,
        updated_at: new Date()
      };

      mockPool.query
        .mockResolvedValueOnce({
          rows: [mockUpdatedWallet]
        })
        .mockResolvedValueOnce({ rows: [] }); // Audit log

      const result = await walletService.creditWallet(userId, amount, metadata);

      expect(result.newBalance).toBe(2000);
      expect(result.previousBalance).toBe(1000);
      expect(result.amount).toBe(amount);
      expect(result.operation).toBe('credit');
      expect(mockCache.del).toHaveBeenCalledWith(`user_balance:${userId}`);
    });

    it('should throw ValidationError for negative amount', async () => {
      const userId = 'user-123';
      const amount = -100;

      await expect(walletService.creditWallet(userId, amount))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for zero amount', async () => {
      const userId = 'user-123';
      const amount = 0;

      await expect(walletService.creditWallet(userId, amount))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent wallet', async () => {
      const userId = 'user-123';
      const amount = 1000;

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(walletService.creditWallet(userId, amount))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('debitWallet', () => {
    it('should debit wallet balance successfully', async () => {
      const userId = 'user-123';
      const amount = 500;
      const metadata = { purpose: 'payment' };

      // Mock current balance check
      const mockBalance = {
        balance: 1000,
        confirmedBalance: 1000,
        unconfirmedBalance: 0,
        totalBalance: 1000
      };

      mockCache.get.mockResolvedValue(JSON.stringify(mockBalance));

      const mockUpdatedWallet = {
        id: 'wallet-123',
        user_id: userId,
        balance: 500,
        updated_at: new Date()
      };

      mockPool.query
        .mockResolvedValueOnce({
          rows: [mockUpdatedWallet]
        })
        .mockResolvedValueOnce({ rows: [] }); // Audit log

      const result = await walletService.debitWallet(userId, amount, metadata);

      expect(result.newBalance).toBe(500);
      expect(result.previousBalance).toBe(1000);
      expect(result.amount).toBe(amount);
      expect(result.operation).toBe('debit');
      expect(mockCache.del).toHaveBeenCalledWith(`user_balance:${userId}`);
    });

    it('should throw ValidationError for insufficient balance', async () => {
      const userId = 'user-123';
      const amount = 2000;

      // Mock current balance check
      const mockBalance = {
        balance: 1000,
        confirmedBalance: 1000,
        unconfirmedBalance: 0,
        totalBalance: 1000
      };

      mockCache.get.mockResolvedValue(JSON.stringify(mockBalance));

      await expect(walletService.debitWallet(userId, amount))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for negative amount', async () => {
      const userId = 'user-123';
      const amount = -100;

      await expect(walletService.debitWallet(userId, amount))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent wallet', async () => {
      const userId = 'user-123';
      const amount = 500;

      mockCache.get.mockRejectedValue(new NotFoundError('Wallet not found'));

      await expect(walletService.debitWallet(userId, amount))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('getWalletByUserId', () => {
    it('should return wallet details by user ID', async () => {
      const userId = 'user-123';
      const mockWallet = {
        id: 'wallet-123',
        user_id: userId,
        wallet_type: 'phoenix',
        lightning_address: 'user@example.com',
        balance: 1000,
        confirmed_balance: 1000,
        unconfirmed_balance: 0,
        phone_number: '254700000000',
        email: 'user@example.com',
        user_status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockWallet]
      });

      const result = await walletService.getWalletByUserId(userId);

      expect(result.id).toBe('wallet-123');
      expect(result.userId).toBe(userId);
      expect(result.walletType).toBe('phoenix');
      expect(result.balance).toBe(1000);
    });

    it('should throw NotFoundError for non-existent wallet', async () => {
      const userId = 'user-123';

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(walletService.getWalletByUserId(userId))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('getWalletById', () => {
    it('should return wallet details by wallet ID', async () => {
      const walletId = 'wallet-123';
      const mockWallet = {
        id: walletId,
        user_id: 'user-123',
        wallet_type: 'phoenix',
        lightning_address: 'user@example.com',
        balance: 1000,
        confirmed_balance: 1000,
        unconfirmed_balance: 0,
        phone_number: '254700000000',
        email: 'user@example.com',
        user_status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockWallet]
      });

      const result = await walletService.getWalletById(walletId);

      expect(result.id).toBe(walletId);
      expect(result.userId).toBe('user-123');
      expect(result.walletType).toBe('phoenix');
      expect(result.balance).toBe(1000);
    });

    it('should throw NotFoundError for non-existent wallet', async () => {
      const walletId = 'wallet-123';

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(walletService.getWalletById(walletId))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('updateWalletSettings', () => {
    it('should update wallet settings successfully', async () => {
      const userId = 'user-123';
      const settings = {
        walletType: 'breez',
        lightningAddress: 'newuser@example.com'
      };

      const mockUpdatedWallet = {
        id: 'wallet-123',
        user_id: userId,
        wallet_type: settings.walletType,
        lightning_address: settings.lightningAddress,
        updated_at: new Date()
      };

      mockPool.query
        .mockResolvedValueOnce({
          rows: [mockUpdatedWallet]
        })
        .mockResolvedValueOnce({ rows: [] }); // User update

      const result = await walletService.updateWalletSettings(userId, settings);

      expect(result.walletType).toBe(settings.walletType);
      expect(result.lightningAddress).toBe(settings.lightningAddress);
      expect(mockCache.del).toHaveBeenCalledWith(`user_balance:${userId}`);
    });

    it('should throw ValidationError for invalid wallet type', async () => {
      const userId = 'user-123';
      const settings = {
        walletType: 'invalid'
      };

      await expect(walletService.updateWalletSettings(userId, settings))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent wallet', async () => {
      const userId = 'user-123';
      const settings = { walletType: 'breez' };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(walletService.updateWalletSettings(userId, settings))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('getWalletTransactions', () => {
    it('should return paginated wallet transactions', async () => {
      const userId = 'user-123';
      const mockTransactions = [
        { id: 'txn-1', amount: 1000, type: 'credit' },
        { id: 'txn-2', amount: 500, type: 'debit' }
      ];

      mockPool.query
        .mockResolvedValueOnce({
          rows: mockTransactions
        })
        .mockResolvedValueOnce({
          rows: [{ count: '2' }]
        });

      const result = await walletService.getWalletTransactions(userId, {
        page: 1,
        limit: 20
      });

      expect(result.transactions).toEqual(mockTransactions);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter transactions by type', async () => {
      const userId = 'user-123';
      const mockTransactions = [
        { id: 'txn-1', amount: 1000, type: 'credit' }
      ];

      mockPool.query
        .mockResolvedValueOnce({
          rows: mockTransactions
        })
        .mockResolvedValueOnce({
          rows: [{ count: '1' }]
        });

      const result = await walletService.getWalletTransactions(userId, {
        page: 1,
        limit: 20,
        type: 'credit'
      });

      expect(result.transactions).toEqual(mockTransactions);
    });
  });

  describe('getWalletStats', () => {
    it('should return wallet statistics for 30 days', async () => {
      const userId = 'user-123';
      const mockStats = {
        total_transactions: 10,
        credit_transactions: 6,
        debit_transactions: 4,
        total_credits: 15000,
        total_debits: 8000,
        avg_transaction_amount: 2300
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockStats]
      });

      const result = await walletService.getWalletStats(userId, '30d');

      expect(result).toEqual(mockStats);
    });

    it('should return wallet statistics for 7 days', async () => {
      const userId = 'user-123';
      const mockStats = {
        total_transactions: 5,
        credit_transactions: 3,
        debit_transactions: 2,
        total_credits: 8000,
        total_debits: 3000,
        avg_transaction_amount: 2200
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockStats]
      });

      const result = await walletService.getWalletStats(userId, '7d');

      expect(result).toEqual(mockStats);
    });
  });

  describe('logBalanceOperation', () => {
    it('should log balance operation successfully', async () => {
      const userId = 'user-123';
      const operation = 'credit';
      const amount = 1000;
      const metadata = { source: 'payment' };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await walletService.logBalanceOperation(userId, operation, amount, metadata);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          userId,
          'wallet_credit',
          expect.stringContaining('"amount":1000'),
          null,
          null
        ])
      );
    });

    it('should not throw error on audit log failure', async () => {
      const userId = 'user-123';
      const operation = 'debit';
      const amount = 500;

      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      // Should not throw error
      await expect(walletService.logBalanceOperation(userId, operation, amount))
        .resolves
        .toBeUndefined();
    });
  });
});
