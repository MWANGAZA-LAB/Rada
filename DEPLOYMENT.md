# Rada Payment System - Deployment Guide

This guide covers the complete deployment process for the Rada Payment System, including local development, staging, and production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Production Deployment](#production-deployment)
4. [GitHub Actions CI/CD](#github-actions-cicd)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [Monitoring and Logging](#monitoring-and-logging)
7. [Security Considerations](#security-considerations)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Docker** (version 20.10 or higher)
- **Docker Compose** (version 2.0 or higher)
- **Node.js** (version 18 or higher) - for local development
- **Git** (version 2.30 or higher)
- **OpenSSL** - for SSL certificate generation

### System Requirements

- **CPU**: Minimum 2 cores, recommended 4+ cores
- **RAM**: Minimum 4GB, recommended 8GB+
- **Storage**: Minimum 20GB free space
- **Network**: Stable internet connection for external API calls

### External Services

- **GitHub Account** - for repository hosting and CI/CD
- **M-Pesa API Credentials** - for payment processing
- **Lightning Network Node** - for Bitcoin payments
- **Exchange Rate API** - for currency conversion
- **SMTP Server** - for email notifications

## Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/rada-payment-system.git
cd rada-payment-system
```

### 2. Environment Configuration

Copy the environment template and configure it for development:

```bash
cp env.development .env.development
```

Edit `.env.development` and update the following values:

```bash
# Update these with your actual development credentials
MPESA_CONSUMER_KEY=your_mpesa_consumer_key
MPESA_CONSUMER_SECRET=your_mpesa_consumer_secret
JWT_SECRET=your_development_jwt_secret
```

### 3. Start Development Environment

```bash
# Start all services
docker-compose up -d

# Or use the deployment script
./scripts/deploy.sh development
```

### 4. Verify Installation

Check that all services are running:

```bash
docker-compose ps
```

Access the application:
- **API Gateway**: http://localhost:3000
- **Health Check**: http://localhost/health
- **HTTPS**: https://localhost (development SSL)

### 5. Database Setup

The database schema will be automatically created on first run. To manually run migrations:

```bash
docker exec rada-postgres psql -U rada_user -d rada_dev -f /docker-entrypoint-initdb.d/01-schema.sql
```

## Production Deployment

### 1. Environment Configuration

Copy and configure the production environment:

```bash
cp env.production .env.production
```

**IMPORTANT**: Update all placeholder values in `.env.production` with actual production credentials.

### 2. SSL Certificate Setup

For production, you need valid SSL certificates:

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Copy your SSL certificates
cp your-domain.crt nginx/ssl/rada.crt
cp your-domain.key nginx/ssl/rada.key
```

### 3. Production Deployment

```bash
# Deploy to production
./scripts/deploy.sh production
```

### 4. Verify Production Deployment

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Test health endpoints
curl https://your-domain.com/health
```

## GitHub Actions CI/CD

The project includes comprehensive GitHub Actions workflows for automated testing and deployment.

### Workflow Overview

1. **API Pipeline** (`api-pipeline.yml`)
   - Runs on pushes to `main` and `develop` branches
   - Executes tests, security scans, and builds Docker images
   - Deploys to staging (develop) and production (main)

2. **Mobile Pipeline** (`mobile-pipeline.yml`)
   - Handles React Native mobile app builds
   - Generates APK/IPA files for distribution

3. **Integration Tests** (`integration-tests.yml`)
   - Runs comprehensive integration tests
   - Validates service interactions

### Required GitHub Secrets

Configure these secrets in your GitHub repository:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# JWT
JWT_SECRET=your-secure-jwt-secret

# M-Pesa
MPESA_CONSUMER_KEY=your-mpesa-key
MPESA_CONSUMER_SECRET=your-mpesa-secret

# Kubernetes
KUBE_CONFIG_STAGING=base64-encoded-kubeconfig
KUBE_CONFIG_PRODUCTION=base64-encoded-kubeconfig

# Security
SNYK_TOKEN=your-snyk-token
```

### Manual Workflow Triggers

You can manually trigger workflows:

```bash
# Via GitHub CLI
gh workflow run api-pipeline.yml
gh workflow run mobile-pipeline.yml
```

## Kubernetes Deployment

### 1. Prerequisites

- Kubernetes cluster (1.20+)
- Helm (3.0+)
- kubectl configured

### 2. Deploy with Helm

```bash
# Add the repository
helm repo add rada https://your-helm-repo.com

# Install the chart
helm install rada ./helm \
  --namespace rada-production \
  --create-namespace \
  --set image.tag=latest \
  --set env.NODE_ENV=production
```

### 3. Update Deployment

```bash
helm upgrade rada ./helm \
  --namespace rada-production \
  --set image.tag=new-version
```

### 4. Monitor Deployment

```bash
# Check pod status
kubectl get pods -n rada-production

# Check service status
kubectl get svc -n rada-production

# View logs
kubectl logs -f deployment/rada-api-gateway -n rada-production
```

## Monitoring and Logging

### 1. Application Logs

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api-gateway

# View production logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 2. Database Monitoring

```bash
# Connect to database
docker exec -it rada-postgres psql -U rada_user -d rada_dev

# Check database size
SELECT pg_size_pretty(pg_database_size('rada_dev'));

# Check active connections
SELECT count(*) FROM pg_stat_activity;
```

### 3. Redis Monitoring

```bash
# Connect to Redis
docker exec -it rada-redis redis-cli

# Check Redis info
INFO

# Monitor Redis operations
MONITOR
```

### 4. Health Checks

```bash
# API Gateway health
curl http://localhost:3000/health

# Detailed health check
curl http://localhost:3000/health/detailed

# Kubernetes health checks
kubectl get endpoints -n rada-production
```

## Security Considerations

### 1. Environment Variables

- Never commit `.env` files to version control
- Use strong, unique passwords for all services
- Rotate secrets regularly
- Use environment-specific configurations

### 2. Network Security

- Use HTTPS in production
- Configure proper CORS settings
- Implement rate limiting
- Use firewall rules to restrict access

### 3. Database Security

- Use strong database passwords
- Enable SSL connections
- Regular security updates
- Backup encryption

### 4. Application Security

- Keep dependencies updated
- Regular security scans
- Input validation and sanitization
- Proper error handling

## Troubleshooting

### Common Issues

#### 1. Docker Build Failures

```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

#### 2. Database Connection Issues

```bash
# Check database status
docker exec rada-postgres pg_isready -U rada_user

# Check database logs
docker logs rada-postgres
```

#### 3. Redis Connection Issues

```bash
# Check Redis status
docker exec rada-redis redis-cli ping

# Check Redis logs
docker logs rada-redis
```

#### 4. Service Health Check Failures

```bash
# Check service logs
docker-compose logs api-gateway

# Check service configuration
docker-compose config
```

#### 5. SSL Certificate Issues

```bash
# Verify certificate
openssl x509 -in nginx/ssl/rada.crt -text -noout

# Check Nginx configuration
docker exec rada-nginx nginx -t
```

### Performance Issues

#### 1. High Memory Usage

```bash
# Check container resource usage
docker stats

# Optimize Redis memory
docker exec rada-redis redis-cli CONFIG SET maxmemory 512mb
```

#### 2. Slow Database Queries

```bash
# Check slow queries
docker exec rada-postgres psql -U rada_user -d rada_dev -c "
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
"
```

### Recovery Procedures

#### 1. Database Recovery

```bash
# Restore from backup
docker exec -i rada-postgres psql -U rada_user -d rada_dev < backup.sql
```

#### 2. Service Recovery

```bash
# Restart specific service
docker-compose restart api-gateway

# Restart all services
docker-compose restart
```

#### 3. Complete System Recovery

```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: This will delete data)
docker-compose down -v

# Rebuild and restart
./scripts/deploy.sh production
```

## Support

For deployment issues:

1. Check the logs: `docker-compose logs`
2. Verify configuration: `docker-compose config`
3. Check system resources: `docker stats`
4. Review this documentation
5. Create an issue in the GitHub repository

## Contributing

To contribute to the deployment process:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This deployment guide is part of the Rada Payment System and is licensed under the same terms as the main project.
