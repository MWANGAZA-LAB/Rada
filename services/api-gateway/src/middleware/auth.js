const jwt = require('jsonwebtoken');
const { ValidationError, AuthenticationError } = require('../utils/errors');

const validateAuthHeader = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ValidationError('Authorization header must start with Bearer');
  }
  return authHeader.split(' ')[1];
};

const validateToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }
  
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Invalid token format');
    } else {
      throw new AuthenticationError('Invalid or expired token');
    }
  }
};

exports.authenticateUser = async (req, res, next) => {
  try {
    const token = validateAuthHeader(req.headers.authorization);
    const decoded = validateToken(token);
    
    req.user = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

exports.authenticateMerchant = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      throw new ValidationError('No API key provided');
    }

    // Import MerchantService dynamically to avoid circular dependencies
    const { MerchantService } = require('../services/merchantService');
    const merchant = await MerchantService.findByApiKey(apiKey);
    
    if (!merchant) {
      throw new AuthenticationError('Invalid API key');
    }

    req.merchant = merchant;
    next();
  } catch (error) {
    next(error);
  }
};
