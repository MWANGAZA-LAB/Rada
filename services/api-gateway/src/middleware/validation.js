const Joi = require('joi');
const { ValidationError } = require('../utils/errors');

// Validation schemas
const phoneNumberSchema = Joi.string()
  .pattern(/^254[17]\d{8}$/)
  .required()
  .messages({
    'string.pattern.base': 'Phone number must be a valid Kenyan number starting with 254',
    'any.required': 'Phone number is required'
  });

const emailSchema = Joi.string()
  .email()
  .optional()
  .messages({
    'string.email': 'Please provide a valid email address'
  });

const amountSchema = Joi.number()
  .positive()
  .max(150000)
  .precision(2)
  .required()
  .messages({
    'number.max': 'Amount cannot exceed 150,000 KES',
    'number.positive': 'Amount must be positive',
    'any.required': 'Amount is required'
  });

const uuidSchema = Joi.string()
  .uuid()
  .required()
  .messages({
    'string.guid': 'Invalid UUID format',
    'any.required': 'ID is required'
  });

// Validation schemas for different endpoints
const validationSchemas = {
  // Auth endpoints
  register: Joi.object({
    phoneNumber: phoneNumberSchema,
    email: emailSchema
  }),

  login: Joi.object({
    phoneNumber: phoneNumberSchema
  }),

  updateProfile: Joi.object({
    email: emailSchema.optional()
  }),

  refresh: Joi.object({
    refreshToken: Joi.string().required()
  }),

  // Payment endpoints
  createPayment: Joi.object({
    amount: amountSchema,
    currency: Joi.string().valid('KES', 'BTC', 'USD', 'EUR').required(),
    paymentMethod: Joi.string().valid('mpesa', 'bitcoin', 'lightning').required(),
    merchantId: uuidSchema.optional(),
    description: Joi.string().max(500).optional(),
    metadata: Joi.object().optional()
  }),

  updateTransactionStatus: Joi.object({
    status: Joi.string().valid('pending', 'processing', 'completed', 'failed', 'cancelled').required(),
    metadata: Joi.object().optional()
  }),

  validatePayment: Joi.object({
    amount: amountSchema,
    currency: Joi.string().valid('KES', 'BTC', 'USD', 'EUR').required(),
    paymentMethod: Joi.string().valid('mpesa', 'bitcoin', 'lightning').required(),
    operation: Joi.string().valid('credit', 'debit').optional()
  }),

  getPayments: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('pending', 'processing', 'completed', 'failed', 'cancelled').optional(),
    paymentMethod: Joi.string().valid('mpesa', 'bitcoin', 'lightning').optional()
  }),

  getPaymentStats: Joi.object({
    period: Joi.string().valid('7d', '30d', '90d').default('30d')
  }),

  // Transaction endpoints
  getTransaction: Joi.object({
    id: uuidSchema
  }),

  transactionId: Joi.object({
    transactionId: uuidSchema
  }),

  // Wallet endpoints
  createWallet: Joi.object({
    walletType: Joi.string().valid('phoenix', 'breez', 'muun').default('phoenix'),
    lightningAddress: Joi.string().email().optional()
  }),

  updateWallet: Joi.object({
    walletType: Joi.string().valid('phoenix', 'breez', 'muun').optional(),
    lightningAddress: Joi.string().email().optional()
  }),

  creditWallet: Joi.object({
    amount: amountSchema,
    metadata: Joi.object().optional()
  }),

  debitWallet: Joi.object({
    amount: amountSchema,
    metadata: Joi.object().optional()
  }),

  validateLightningAddress: Joi.object({
    lightningAddress: Joi.string().email().required()
  }),

  getWalletTransactions: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    type: Joi.string().valid('credit', 'debit').optional()
  }),

  getWalletStats: Joi.object({
    period: Joi.string().valid('7d', '30d', '90d').default('30d')
  }),

  walletId: Joi.object({
    walletId: uuidSchema
  }),

  connectWallet: Joi.object({
    walletType: Joi.string().valid('phoenix', 'breez', 'muun').required(),
    lightningAddress: Joi.string().email().required()
  }),

  // Merchant endpoints
  createMerchant: Joi.object({
    businessName: Joi.string().min(2).max(255).required(),
    mpesaShortcode: Joi.string().pattern(/^\d{5,6}$/).optional(),
    mpesaPhone: phoneNumberSchema.optional(),
    contactEmail: emailSchema
  }),

  updateMerchant: Joi.object({
    businessName: Joi.string().min(2).max(255).optional(),
    mpesaShortcode: Joi.string().pattern(/^\d{5,6}$/).optional(),
    mpesaPhone: phoneNumberSchema.optional(),
    contactEmail: emailSchema
  }),

  // User endpoints
  updateUser: Joi.object({
    email: emailSchema,
    lightningAddress: Joi.string().email().optional(),
    walletType: Joi.string().valid('phoenix', 'breez', 'muun').optional()
  })
};

// Generic validation middleware
const validateRequest = (schemaName) => {
  return (req, res, next) => {
    const schema = validationSchemas[schemaName];
    
    if (!schema) {
      return next(new Error(`Validation schema '${schemaName}' not found`));
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return next(new ValidationError('Validation failed', validationErrors));
    }
    
    req.validatedData = value;
    next();
  };
};

// URL parameter validation
const validateParams = (paramSchema) => {
  return (req, res, next) => {
    const { error, value } = paramSchema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return next(new ValidationError('Invalid URL parameters', validationErrors));
    }
    
    req.validatedParams = value;
    next();
  };
};

// Query parameter validation
const validateQuery = (querySchema) => {
  return (req, res, next) => {
    const { error, value } = querySchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return next(new ValidationError('Invalid query parameters', validationErrors));
    }
    
    req.validatedQuery = value;
    next();
  };
};

// Custom validation functions
const validatePagination = (req, res, next) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('created_at', 'amount', 'status').default('created_at'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  });

  const { error, value } = schema.validate(req.query);
  
  if (error) {
    return next(new ValidationError('Invalid pagination parameters'));
  }
  
  req.pagination = value;
  next();
};

module.exports = {
  validateRequest,
  validateParams,
  validateQuery,
  validatePagination,
  validationSchemas
};
