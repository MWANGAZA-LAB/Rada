const jwt = require('jsonwebtoken');
const { Router } = require('express');
const router = Router();
const { authenticateUser } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const UserService = require('../services/userService');
const ResponseHandler = require('../utils/responseHandler');
const logger = require('../utils/logger');

// Register new user
router.post('/register', 
  validateRequest('register'),
  async (req, res, next) => {
    try {
      const { phoneNumber, email } = req.validatedData;
      
      const user = await UserService.createUser({ phoneNumber, email });
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, phoneNumber: user.phone_number },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      logger.info('User registered successfully', { userId: user.id });
      
      return ResponseHandler.success(res, {
        token,
        user: {
          id: user.id,
          phoneNumber: user.phone_number,
          email: user.email,
          createdAt: user.created_at
        }
      }, 'User registered successfully');
    } catch (error) {
      next(error);
    }
  }
);

// Login user
router.post('/login', 
  validateRequest('login'),
  async (req, res, next) => {
    try {
      const { phoneNumber } = req.validatedData;
      
      const user = await UserService.findByPhone(phoneNumber);
      if (!user) {
        return ResponseHandler.error(res, new Error('User not found'), 404);
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, phoneNumber: user.phone_number },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      logger.info('User logged in successfully', { userId: user.id });
      
      return ResponseHandler.success(res, {
        token,
        user: {
          id: user.id,
          phoneNumber: user.phone_number,
          email: user.email,
          createdAt: user.created_at
        }
      }, 'Login successful');
    } catch (error) {
      next(error);
    }
  }
);

// Get current user profile
router.get('/me', 
  authenticateUser,
  async (req, res, next) => {
    try {
      const user = await UserService.findById(req.user.userId);
      
      return ResponseHandler.success(res, {
        id: user.id,
        phoneNumber: user.phone_number,
        email: user.email,
        lightningAddress: user.lightning_address,
        walletType: user.wallet_type,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }, 'User profile retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
);

// Update user profile
router.put('/me',
  authenticateUser,
  validateRequest('updateUser'),
  async (req, res, next) => {
    try {
      const updates = req.validatedData;
      const user = await UserService.updateUser(req.user.userId, updates);
      
      logger.info('User profile updated', { userId: user.id });
      
      return ResponseHandler.success(res, {
        id: user.id,
        phoneNumber: user.phone_number,
        email: user.email,
        lightningAddress: user.lightning_address,
        walletType: user.wallet_type,
        updatedAt: user.updated_at
      }, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

// Refresh token
router.post('/refresh',
  authenticateUser,
  async (req, res, next) => {
    try {
      const user = await UserService.findById(req.user.userId);
      
      // Generate new JWT token
      const token = jwt.sign(
        { userId: user.id, phoneNumber: user.phone_number },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      logger.info('Token refreshed', { userId: user.id });
      
      return ResponseHandler.success(res, {
        token,
        user: {
          id: user.id,
          phoneNumber: user.phone_number,
          email: user.email
        }
      }, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
