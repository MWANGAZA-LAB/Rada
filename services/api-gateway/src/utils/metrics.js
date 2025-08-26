const promClient = require('prom-client');
const logger = require('./logger');

// Create a Registry to store metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory usage, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const paymentProcessingDuration = new promClient.Histogram({
  name: 'payment_processing_duration_seconds',
  help: 'Duration of payment processing in seconds',
  labelNames: ['status', 'payment_type'],
  buckets: [1, 5, 10, 30, 60]
});

const activeTransactions = new promClient.Gauge({
  name: 'active_transactions',
  help: 'Number of active transactions'
});

const failedTransactions = new promClient.Counter({
  name: 'failed_transactions_total',
  help: 'Total number of failed transactions',
  labelNames: ['error_type']
});

const mpesaApiLatency = new promClient.Histogram({
  name: 'mpesa_api_latency_seconds',
  help: 'M-PESA API request latency',
  labelNames: ['endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

// Register custom metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(paymentProcessingDuration);
register.registerMetric(activeTransactions);
register.registerMetric(failedTransactions);
register.registerMetric(mpesaApiLatency);

// Middleware to collect HTTP metrics
const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime();
  
  res.once('finish', () => {
    const duration = process.hrtime(start);
    const durationSeconds = duration[0] + duration[1] / 1e9;
    
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(durationSeconds);
  });
  
  next();
};

// Function to record payment metrics
const recordPaymentMetrics = async (paymentType, status, duration) => {
  try {
    paymentProcessingDuration
      .labels(status, paymentType)
      .observe(duration);

    if (status === 'failed') {
      failedTransactions.inc({ error_type: paymentType });
    }
  } catch (error) {
    logger.error('Failed to record metrics', { error });
  }
};

// Function to update active transactions count
const updateActiveTransactions = (count) => {
  activeTransactions.set(count);
};

// Function to record M-PESA API latency
const recordMpesaLatency = (endpoint, duration) => {
  mpesaApiLatency.labels(endpoint).observe(duration);
};

// Metrics endpoint handler
const getMetrics = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error('Failed to generate metrics', { error });
    res.status(500).end();
  }
};

module.exports = {
  metricsMiddleware,
  recordPaymentMetrics,
  updateActiveTransactions,
  recordMpesaLatency,
  getMetrics
};
