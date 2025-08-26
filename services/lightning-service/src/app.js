const express = require('express');
const { authenticateLnd } = require('ln-service');
const { generateInvoice, payInvoice } = require('./controllers/lightning');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const port = process.env.PORT || 3001;

// Initialize LND connection
const lnd = authenticateLnd({
  cert: process.env.LND_CERT,
  macaroon: process.env.LND_MACAROON,
  socket: process.env.LND_GRPC_HOST
});

app.use(express.json());

// Routes
app.post('/api/invoice/create', generateInvoice);
app.post('/api/invoice/pay', payInvoice);

// Error handling
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Lightning service running on port ${port}`);
});
