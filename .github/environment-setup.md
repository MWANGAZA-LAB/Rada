# GitHub Actions Environment Setup Guide

## Required Environments

1. Staging Environment
2. Production Environment

## Environment Setup Steps

### 1. Create Environments in GitHub

1. Go to your repository settings
2. Navigate to "Environments"
3. Create two new environments:
   - `staging`
   - `production`

### 2. Configure Environment Protection Rules

#### Staging Environment:
- Required reviewers: Add team leads
- Deployment branches: 
  - Selected branches
  - Allow `develop` branch only

#### Production Environment:
- Required reviewers: Add senior engineers
- Deployment branches:
  - Selected branches
  - Allow `main` branch only
- Add wait timer: 15 minutes

### 3. Environment Secrets

#### Staging Environment Secrets:
```
KUBE_CONFIG_STAGING
JWT_SECRET
MPESA_CONSUMER_KEY
MPESA_CONSUMER_SECRET
PLAY_STORE_JSON_KEY
APPSTORE_ISSUER_ID
APPSTORE_API_KEY_ID
APPSTORE_API_PRIVATE_KEY
```

#### Production Environment Secrets:
```
KUBE_CONFIG_PRODUCTION
JWT_SECRET
MPESA_CONSUMER_KEY
MPESA_CONSUMER_SECRET
PLAY_STORE_JSON_KEY
APPSTORE_ISSUER_ID
APPSTORE_API_KEY_ID
APPSTORE_API_PRIVATE_KEY
```

### 4. Repository Secrets (Non-environment specific)
```
ANDROID_SIGNING_KEY
ANDROID_ALIAS
ANDROID_KEY_STORE_PASSWORD
ANDROID_KEY_PASSWORD
SNYK_TOKEN
```

## Important Notes

1. Staging and Production should use different:
   - Kubernetes clusters
   - M-PESA API credentials
   - App Store/Play Store credentials

2. Security best practices:
   - Rotate secrets regularly
   - Limit access to environment settings
   - Enable branch protection rules
   - Enforce status checks

3. Monitoring:
   - Set up notifications for deployment failures
   - Monitor deployment frequencies
   - Track deployment success rates
