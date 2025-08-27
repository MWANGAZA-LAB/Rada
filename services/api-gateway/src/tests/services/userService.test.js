const UserService = require('../../services/userService');
const { ValidationError, NotFoundError, DatabaseError } = require('../../utils/errors');

// Mock the database pool
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    end: jest.fn()
  }))
}));

describe('UserService', () => {
  let userService;
  let mockPool;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Get the mocked pool instance
    const { Pool } = require('pg');
    mockPool = new Pool();
    userService = require('../../services/userService');
  });

  describe('createUser', () => {
    it('should create a user successfully with valid data', async () => {
      const userData = {
        phoneNumber: '254712345678',
        email: 'test@example.com'
      };

      const expectedUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        phone_number: '254712345678',
        email: 'test@example.com',
        created_at: new Date()
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [expectedUser]
      });

      const result = await userService.createUser(userData);

      expect(result).toEqual(expectedUser);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        ['254712345678', 'test@example.com']
      );
    });

    it('should throw ValidationError for invalid phone number', async () => {
      const userData = {
        phoneNumber: '1234567890', // Invalid format
        email: 'test@example.com'
      };

      await expect(userService.createUser(userData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid email', async () => {
      const userData = {
        phoneNumber: '254712345678',
        email: 'invalid-email' // Invalid format
      };

      await expect(userService.createUser(userData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for duplicate phone number', async () => {
      const userData = {
        phoneNumber: '254712345678',
        email: 'test@example.com'
      };

      // Mock existing user check
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'existing-user-id' }]
      });

      await expect(userService.createUser(userData))
        .rejects
        .toThrow(ValidationError);
    });

    it('should handle database errors gracefully', async () => {
      const userData = {
        phoneNumber: '254712345678',
        email: 'test@example.com'
      };

      mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(userService.createUser(userData))
        .rejects
        .toThrow(DatabaseError);
    });
  });

  describe('findByPhone', () => {
    it('should find user by valid phone number', async () => {
      const phoneNumber = '254712345678';
      const expectedUser = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        phone_number: '254712345678',
        email: 'test@example.com',
        created_at: new Date()
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [expectedUser]
      });

      const result = await userService.findByPhone(phoneNumber);

      expect(result).toEqual(expectedUser);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [phoneNumber]
      );
    });

    it('should return null for non-existent phone number', async () => {
      const phoneNumber = '254700000000';

      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      const result = await userService.findByPhone(phoneNumber);

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const phoneNumber = '254712345678';

      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(userService.findByPhone(phoneNumber))
        .rejects
        .toThrow(DatabaseError);
    });
  });

  describe('findById', () => {
    it('should find user by valid ID', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedUser = {
        id: userId,
        phone_number: '254712345678',
        email: 'test@example.com',
        created_at: new Date()
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [expectedUser]
      });

      const result = await userService.findById(userId);

      expect(result).toEqual(expectedUser);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [userId]
      );
    });

    it('should throw NotFoundError for non-existent user ID', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      await expect(userService.findById(userId))
        .rejects
        .toThrow(NotFoundError);
    });

    it('should handle database errors gracefully', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';

      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(userService.findById(userId))
        .rejects
        .toThrow(DatabaseError);
    });
  });

  describe('updateUser', () => {
    it('should update user successfully with valid data', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const updates = {
        email: 'updated@example.com',
        lightning_address: 'user@phoenix.wallet'
      };

      const expectedUser = {
        id: userId,
        phone_number: '254712345678',
        email: 'updated@example.com',
        lightning_address: 'user@phoenix.wallet',
        updated_at: new Date()
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [expectedUser]
      });

      const result = await userService.updateUser(userId, updates);

      expect(result).toEqual(expectedUser);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        [userId, 'updated@example.com', 'user@phoenix.wallet']
      );
    });

    it('should throw ValidationError for invalid email', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const updates = {
        email: 'invalid-email'
      };

      await expect(userService.updateUser(userId, updates))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for no valid fields to update', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const updates = {
        invalidField: 'value'
      };

      await expect(userService.updateUser(userId, updates))
        .rejects
        .toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent user', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const updates = {
        email: 'updated@example.com'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: []
      });

      await expect(userService.updateUser(userId, updates))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('validation methods', () => {
    describe('isValidPhoneNumber', () => {
      it('should return true for valid Kenyan phone numbers', () => {
        expect(userService.isValidPhoneNumber('254712345678')).toBe(true);
        expect(userService.isValidPhoneNumber('254787654321')).toBe(true);
      });

      it('should return false for invalid phone numbers', () => {
        expect(userService.isValidPhoneNumber('1234567890')).toBe(false);
        expect(userService.isValidPhoneNumber('25471234567')).toBe(false); // Too short
        expect(userService.isValidPhoneNumber('2547123456789')).toBe(false); // Too long
        expect(userService.isValidPhoneNumber('254812345678')).toBe(false); // Invalid prefix
      });
    });

    describe('isValidEmail', () => {
      it('should return true for valid email addresses', () => {
        expect(userService.isValidEmail('test@example.com')).toBe(true);
        expect(userService.isValidEmail('user.name@domain.co.uk')).toBe(true);
      });

      it('should return false for invalid email addresses', () => {
        expect(userService.isValidEmail('invalid-email')).toBe(false);
        expect(userService.isValidEmail('test@')).toBe(false);
        expect(userService.isValidEmail('@example.com')).toBe(false);
        expect(userService.isValidEmail('')).toBe(false);
      });
    });
  });
});
