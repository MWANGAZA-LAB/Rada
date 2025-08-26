#!/bin/bash

# Constants
MIN_SECRET_LENGTH=32
SECRETS_DIR="./generated-secrets"
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Create secrets directory with restricted permissions
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

# Function to generate a strong random secret
generate_secret() {
    openssl rand -base64 48 | tr -d '\n/'
}

# Function to encrypt a secret
encrypt_secret() {
    echo "$1" | openssl enc -aes-256-cbc -salt -pbkdf2 -pass pass:"$ENCRYPTION_KEY" -base64
}

# Function to generate and store a secret
generate_and_store_secret() {
    local secret_name=$1
    local secret_value
    local encrypted_value
    
    if [ -n "$2" ]; then
        secret_value=$2
    else
        secret_value=$(generate_secret)
    fi
    
    encrypted_value=$(encrypt_secret "$secret_value")
    echo "$encrypted_value" > "$SECRETS_DIR/${secret_name}.enc"
    echo "$secret_value" > "$SECRETS_DIR/${secret_name}.txt"
    chmod 600 "$SECRETS_DIR/${secret_name}.enc" "$SECRETS_DIR/${secret_name}.txt"
    
    echo -e "${GREEN}Generated${NC} ${YELLOW}$secret_name${NC}"
}

echo -e "${GREEN}Rada Security Infrastructure - Secrets Generator${NC}"
echo "=================================================="

# Generate Application Secrets
generate_and_store_secret "JWT_SECRET"
generate_and_store_secret "SESSION_SECRET"
generate_and_store_secret "ENCRYPTION_KEY"

# Database Secrets
generate_and_store_secret "DB_PASSWORD"
generate_and_store_secret "DB_ROOT_PASSWORD"
generate_and_store_secret "REDIS_PASSWORD"

# API Keys and External Service Credentials
generate_and_store_secret "MPESA_CONSUMER_KEY"
generate_and_store_secret "MPESA_CONSUMER_SECRET"
generate_and_store_secret "LIGHTNING_NODE_MACAROON"

# Mobile App Signing
echo -e "\n${YELLOW}Generating Android Keystore...${NC}"
keytool -genkey -v \
    -keystore "$SECRETS_DIR/rada.keystore" \
    -alias rada \
    -keyalg RSA \
    -keysize 4096 \
    -validity 10000 \
    -storetype PKCS12

# Convert keystore to base64 for GitHub Actions
base64 "$SECRETS_DIR/rada.keystore" > "$SECRETS_DIR/ANDROID_SIGNING_KEY.txt"

# Generate deployment keys
ssh-keygen -t ed25519 -C "rada-deploy@mwangaza-lab.com" -f "$SECRETS_DIR/deploy_key" -N ""

# Create secrets manifest
cat << EOF > "$SECRETS_DIR/secrets-manifest.yml"
secrets:
  application:
    JWT_SECRET: "Retrieved from $SECRETS_DIR/JWT_SECRET.txt"
    SESSION_SECRET: "Retrieved from $SECRETS_DIR/SESSION_SECRET.txt"
    ENCRYPTION_KEY: "Retrieved from $SECRETS_DIR/ENCRYPTION_KEY.txt"
  
  database:
    DB_PASSWORD: "Retrieved from $SECRETS_DIR/DB_PASSWORD.txt"
    DB_ROOT_PASSWORD: "Retrieved from $SECRETS_DIR/DB_ROOT_PASSWORD.txt"
    REDIS_PASSWORD: "Retrieved from $SECRETS_DIR/REDIS_PASSWORD.txt"
  
  external_services:
    MPESA_CONSUMER_KEY: "Retrieved from $SECRETS_DIR/MPESA_CONSUMER_KEY.txt"
    MPESA_CONSUMER_SECRET: "Retrieved from $SECRETS_DIR/MPESA_CONSUMER_SECRET.txt"
    LIGHTNING_NODE_MACAROON: "Retrieved from $SECRETS_DIR/LIGHTNING_NODE_MACAROON.txt"
  
  mobile:
    ANDROID_SIGNING_KEY: "Retrieved from $SECRETS_DIR/ANDROID_SIGNING_KEY.txt"
    ANDROID_KEY_PASSWORD: "Set during keystore generation"
    ANDROID_STORE_PASSWORD: "Set during keystore generation"
    
  deployment:
    DEPLOY_KEY: "Retrieved from $SECRETS_DIR/deploy_key"
    DEPLOY_KEY_PUB: "Retrieved from $SECRETS_DIR/deploy_key.pub"

rotation_schedule:
  JWT_SECRET: "90 days"
  SESSION_SECRET: "90 days"
  API_KEYS: "180 days"
  DATABASE_CREDENTIALS: "180 days"
  SIGNING_KEYS: "365 days"
EOF

# Create instructions file
cat << EOF > "$SECRETS_DIR/INSTRUCTIONS.md"
# Rada Secrets Management Guide

## Security Notice
The secrets in this directory are SENSITIVE. Never commit them to version control.
Each secret has both an encrypted (.enc) and plaintext (.txt) version.

## Adding Secrets to GitHub
Use the following commands to add secrets to your GitHub repository:

\`\`\`bash
# Application Secrets
gh secret set JWT_SECRET < $SECRETS_DIR/JWT_SECRET.txt
gh secret set SESSION_SECRET < $SECRETS_DIR/SESSION_SECRET.txt
gh secret set ENCRYPTION_KEY < $SECRETS_DIR/ENCRYPTION_KEY.txt

# Database Secrets
gh secret set DB_PASSWORD < $SECRETS_DIR/DB_PASSWORD.txt
gh secret set DB_ROOT_PASSWORD < $SECRETS_DIR/DB_ROOT_PASSWORD.txt
gh secret set REDIS_PASSWORD < $SECRETS_DIR/REDIS_PASSWORD.txt

# External Service Credentials
gh secret set MPESA_CONSUMER_KEY < $SECRETS_DIR/MPESA_CONSUMER_KEY.txt
gh secret set MPESA_CONSUMER_SECRET < $SECRETS_DIR/MPESA_CONSUMER_SECRET.txt
gh secret set LIGHTNING_NODE_MACAROON < $SECRETS_DIR/LIGHTNING_NODE_MACAROON.txt

# Mobile App Signing
gh secret set ANDROID_SIGNING_KEY < $SECRETS_DIR/ANDROID_SIGNING_KEY.txt
\`\`\`

## Secret Rotation
1. Run this script to generate new secrets
2. Update the secrets in GitHub
3. Deploy the changes following the rotation schedule in secrets-manifest.yml
4. Verify application functionality
5. Remove old secrets after confirmation

## Emergency Rotation
In case of a security incident:
1. Run this script with the -emergency flag
2. Update all secrets immediately
3. Force deployment of all services
4. Monitor for any issues
EOF

echo -e "\n${GREEN}Secret Generation Complete!${NC}"
echo -e "${YELLOW}Review the generated files in: $SECRETS_DIR${NC}"
echo -e "${RED}IMPORTANT: Review INSTRUCTIONS.md for next steps${NC}"

# Set restrictive permissions on the secrets directory
chmod -R 700 "$SECRETS_DIR"
