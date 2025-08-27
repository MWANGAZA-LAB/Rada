# Rada Payment System

[![CI/CD](https://github.com/your-username/rada-payment-system/workflows/API%20Pipeline/badge.svg)](https://github.com/your-username/rada-payment-system/actions)
[![Security](https://github.com/your-username/rada-payment-system/workflows/Security%20Scan/badge.svg)](https://github.com/your-username/rada-payment-system/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-%3E%3D20.10-blue.svg)](https://www.docker.com/)

A comprehensive, enterprise-grade payment processing system that integrates M-Pesa, Bitcoin, and Lightning Network payments. Built with Node.js, React Native, and modern DevOps practices.

## 🚀 Features

### Payment Methods
- **M-Pesa Integration** - Complete Safaricom M-Pesa API integration
- **Bitcoin Payments** - Direct Bitcoin transaction processing
- **Lightning Network** - Instant Bitcoin payments via Lightning
- **Multi-Currency Support** - KES, BTC, USD, EUR with real-time exchange rates

### Security & Compliance
- **JWT Authentication** - Secure token-based authentication
- **API Key Management** - Merchant API key system
- **Rate Limiting** - Comprehensive request throttling
- **Input Validation** - Joi-based request validation
- **Security Headers** - Helmet.js security hardening
- **Audit Logging** - Complete transaction and access logging

### Architecture
- **Microservices** - Modular service architecture
- **API Gateway** - Centralized request routing and authentication
- **Service Layer** - Clean separation of business logic
- **Database Optimization** - PostgreSQL with advanced indexing
- **Caching Layer** - Redis for performance optimization

### Development & DevOps
- **Docker Containerization** - Multi-stage production builds
- **Kubernetes Ready** - Helm charts for orchestration
- **CI/CD Pipeline** - GitHub Actions automation
- **Comprehensive Testing** - Unit, integration, and E2E tests
- **Monitoring & Logging** - Winston logging with health checks

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Deployment](#deployment)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Native  │    │   Web Frontend  │    │   Admin Panel   │
│   Mobile App    │    │   (Future)      │    │   (Future)      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      API Gateway          │
                    │   (Authentication,        │
                    │    Rate Limiting,         │
                    │    Request Routing)       │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
┌─────────▼─────────┐  ┌─────────▼─────────┐  ┌─────────▼─────────┐
│   M-Pesa Service  │  │ Lightning Service │  │ Exchange Service  │
│   (Payment Proc.) │  │  (Bitcoin/LN)     │  │  (Rate Updates)   │
└─────────┬─────────┘  └─────────┬─────────┘  └─────────┬─────────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      PostgreSQL           │
                    │   (Primary Database)      │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │       Redis Cache         │
                    │   (Session & Rate Lim.)   │
                    └───────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **Docker** (v20.10 or higher)
- **Docker Compose** (v2.0 or higher)
- **Git** (v2.30 or higher)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/rada-payment-system.git
   cd rada-payment-system
   ```

2. **Configure environment**
   ```bash
   # Copy environment template
   cp env.development .env.development
   
   # Edit with your credentials
   nano .env.development
   ```

3. **Start development environment**
   ```bash
   # Windows
   .\scripts\quick-start.ps1
   
   # Linux/macOS
   chmod +x scripts/deploy.sh
   ./scripts/deploy.sh development
   ```

4. **Access the application**
   - **API Gateway**: http://localhost:3000
   - **Health Check**: http://localhost/health
   - **HTTPS**: https://localhost (development SSL)

### Production Deployment

1. **Configure production environment**
   ```bash
   cp env.production .env.production
   # Edit with production credentials
   ```

2. **Deploy to production**
   ```bash
   ./scripts/deploy.sh production
   ```

## 📚 API Documentation

### Authentication

All API requests require authentication via JWT tokens or API keys.

```bash
# User authentication
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "254700000000", "email": "user@example.com"}'

# Get JWT token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "254700000000"}'
```

### Payment Endpoints

```bash
# Create payment
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "KES",
    "paymentMethod": "mpesa",
    "description": "Payment for services"
  }'

# Get payment status
curl -X GET http://localhost:3000/api/v1/payments/TRANSACTION_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Wallet Management

```bash
# Create wallet
curl -X POST http://localhost:3000/api/v1/wallets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "walletType": "phoenix",
    "lightningAddress": "user@lightning.com"
  }'

# Get wallet balance
curl -X GET http://localhost:3000/api/v1/wallets/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🛠️ Development

### Project Structure

```
rada-payment-system/
├── services/                 # Backend microservices
│   ├── api-gateway/         # Main API gateway
│   ├── mpesa-service/       # M-Pesa integration
│   ├── lightning-service/   # Lightning Network
│   ├── exchange-service/    # Exchange rates
│   └── notification-service/ # Email/SMS notifications
├── mobile-app/              # React Native mobile app
├── database/                # Database schemas and migrations
├── helm/                    # Kubernetes Helm charts
├── nginx/                   # Reverse proxy configuration
├── scripts/                 # Deployment and utility scripts
└── docs/                    # Documentation
```

### Technology Stack

#### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **PostgreSQL** - Primary database
- **Redis** - Caching and sessions
- **JWT** - Authentication
- **Joi** - Request validation
- **Winston** - Logging
- **Jest** - Testing framework

#### Frontend (Mobile)
- **React Native** - Cross-platform mobile development
- **@react-navigation/native** - Navigation
- **@tanstack/react-query** - Data fetching and caching
- **Axios** - HTTP client
- **AsyncStorage** - Secure storage

#### DevOps
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Kubernetes** - Production orchestration
- **Helm** - Kubernetes package manager
- **GitHub Actions** - CI/CD pipeline
- **Nginx** - Reverse proxy and load balancer

### Development Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Start development server
npm run dev

# Build for production
npm run build
```

## 🚀 Deployment

### Docker Deployment

```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

```bash
# Install with Helm
helm install rada ./helm \
  --namespace rada-production \
  --create-namespace \
  --set image.tag=latest

# Update deployment
helm upgrade rada ./helm \
  --namespace rada-production \
  --set image.tag=new-version
```

### Environment Variables

Key environment variables to configure:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db
REDIS_URL=redis://:password@host:port

# Authentication
JWT_SECRET=your-secure-jwt-secret

# M-Pesa
MPESA_CONSUMER_KEY=your-mpesa-key
MPESA_CONSUMER_SECRET=your-mpesa-secret
MPESA_ENVIRONMENT=production

# Lightning Network
LIGHTNING_RPC_HOST=your-lightning-host
LIGHTNING_RPC_PORT=10009
LIGHTNING_MACAROON=your-macaroon

# Exchange Rates
EXCHANGE_API_KEY=your-exchange-api-key
```

## 🧪 Testing

### Test Coverage

The project includes comprehensive testing:

- **Unit Tests** - Individual function and service testing
- **Integration Tests** - API endpoint and service interaction testing
- **E2E Tests** - Complete user workflow testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm test -- --testPathPattern="auth"
npm test -- --testPathPattern="payments"

# Run tests in watch mode
npm run test:watch
```

### Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── services/           # Service layer tests
│   ├── middleware/         # Middleware tests
│   └── utils/              # Utility function tests
├── integration/            # Integration tests
│   ├── auth.test.js        # Authentication flow
│   ├── payments.test.js    # Payment processing
│   └── wallets.test.js     # Wallet operations
└── e2e/                    # End-to-end tests
```

## 🔒 Security

### Security Features

- **JWT Authentication** - Secure token-based authentication
- **API Key Management** - Merchant-specific API keys
- **Rate Limiting** - Request throttling to prevent abuse
- **Input Validation** - Comprehensive request validation
- **SQL Injection Prevention** - Parameterized queries
- **XSS Protection** - Security headers and input sanitization
- **CORS Configuration** - Cross-origin request control
- **HTTPS Enforcement** - SSL/TLS encryption

### Security Best Practices

- Environment variables for sensitive data
- Regular dependency updates
- Comprehensive logging and monitoring
- Database connection encryption
- Secure session management
- Regular security audits

## 📊 Monitoring & Logging

### Health Checks

```bash
# Basic health check
curl http://localhost:3000/health

# Detailed health check
curl http://localhost:3000/health/detailed

# Kubernetes health checks
kubectl get endpoints -n rada-production
```

### Logging

The system uses Winston for structured logging:

```javascript
// Different log levels
logger.info('User registered successfully', { userId: user.id });
logger.error('Payment failed', { error: error.message, transactionId });
logger.warn('Rate limit exceeded', { ip: req.ip });
```

### Metrics

- Request/response times
- Error rates
- Database query performance
- Cache hit rates
- Payment success rates

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Run tests**
   ```bash
   npm test
   npm run lint
   ```
5. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
6. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Development Guidelines

- Follow the existing code style
- Write comprehensive tests
- Update documentation
- Ensure all tests pass
- Follow security best practices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help

- **Documentation**: Check the [DEPLOYMENT.md](DEPLOYMENT.md) for detailed setup instructions
- **Issues**: Create an issue in the GitHub repository
- **Discussions**: Use GitHub Discussions for questions and ideas

### Common Issues

- **Docker issues**: Check Docker is running and has sufficient resources
- **Database connection**: Verify PostgreSQL is running and credentials are correct
- **Payment failures**: Check M-Pesa API credentials and network connectivity

## 🏆 Acknowledgments

- **Safaricom** - M-Pesa API integration
- **Lightning Labs** - Lightning Network protocol
- **Open Source Community** - Various libraries and tools

## 📈 Roadmap

### Upcoming Features

- [ ] **Web Dashboard** - Admin and merchant web interface
- [ ] **Advanced Analytics** - Payment analytics and reporting
- [ ] **Multi-Language Support** - Internationalization
- [ ] **Webhook System** - Real-time payment notifications
- [ ] **Advanced Security** - 2FA, biometric authentication
- [ ] **Mobile SDK** - Native mobile SDK for developers

### Performance Improvements

- [ ] **Database Optimization** - Query optimization and indexing
- [ ] **Caching Strategy** - Advanced Redis caching
- [ ] **Load Balancing** - Horizontal scaling support
- [ ] **CDN Integration** - Global content delivery

---

**Built with ❤️ for the African fintech ecosystem**

For more information, visit [https://rada.co.ke](https://rada.co.ke)
