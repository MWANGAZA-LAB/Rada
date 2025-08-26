#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "Rada CI/CD Secrets Generator"
echo "==========================="
echo

# Directory to store generated secrets
SECRETS_DIR="./ci-secrets"
mkdir -p "$SECRETS_DIR"

# Function to generate random string
generate_random_string() {
    openssl rand -base64 32
}

# Generate JWT secret
JWT_SECRET=$(generate_random_string)
echo -e "${GREEN}Generated JWT_SECRET${NC}"
echo "$JWT_SECRET" > "$SECRETS_DIR/jwt_secret.txt"

# Generate Android keystore
echo -e "\n${GREEN}Generating Android keystore...${NC}"
keytool -genkey -v \
    -keystore "$SECRETS_DIR/rada.keystore" \
    -alias rada \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storetype PKCS12

# Convert keystore to base64
KEYSTORE_BASE64=$(base64 -i "$SECRETS_DIR/rada.keystore")
echo "$KEYSTORE_BASE64" > "$SECRETS_DIR/android_signing_key.txt"

echo -e "\n${GREEN}Generated files:${NC}"
ls -l "$SECRETS_DIR"

echo -e "\n${RED}Important:${NC}"
echo "1. Store these secrets safely and add them to your GitHub repository secrets"
echo "2. Update the mobile-app/ios/exportOptions.plist with your Apple Team ID"
echo "3. Create service account in Google Play Console and save the JSON key"
echo "4. Generate App Store Connect API key and save the credentials"

echo -e "\n${GREEN}Next steps:${NC}"
echo "Run these commands to add secrets to GitHub:"
echo
echo "gh secret set JWT_SECRET < $SECRETS_DIR/jwt_secret.txt"
echo "gh secret set ANDROID_SIGNING_KEY < $SECRETS_DIR/android_signing_key.txt"
echo "gh secret set ANDROID_ALIAS -b \"rada\""
