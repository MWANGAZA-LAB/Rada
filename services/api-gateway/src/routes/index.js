const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const healthRoutes = require('./health');
const paymentRoutes = require('./payments');
const walletRoutes = require('./wallets');

// Health check routes (no versioning)
router.use('/health', healthRoutes);

// API v1 routes
router.use('/auth', authRoutes);
router.use('/payments', paymentRoutes);
router.use('/wallets', walletRoutes);

// TODO: Add other route modules as they are created
// router.use('/transactions', require('./transactions'));
// router.use('/merchants', require('./merchants'));
// router.use('/exchange', require('./exchange'));

// 404 handler for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    code: 'ENDPOINT_NOT_FOUND',
    message: `API endpoint ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
