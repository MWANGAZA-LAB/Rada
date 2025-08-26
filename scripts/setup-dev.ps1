$ErrorActionPreference = "Stop"

# Configuration
$config = @{
    ProjectName = "rada"
    Environment = "development"
    PostgresPort = 5432
    RedisPort = 6379
    ApiPort = 8080
}

# Create necessary directories
$directories = @(
    ".\config",
    ".\secrets",
    ".\logs",
    ".\data\postgres",
    ".\data\redis"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "Created directory: $dir"
    }
}

# Generate secure secrets
function New-RandomSecret {
    $length = 32
    $random = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    $bytes = New-Object byte[] $length
    $random.GetBytes($bytes)
    return [System.Convert]::ToBase64String($bytes)
}

# Generate and store secrets
$secrets = @{
    "JWT_SECRET" = New-RandomSecret
    "DB_PASSWORD" = New-RandomSecret
    "REDIS_PASSWORD" = New-RandomSecret
    "MPESA_CONSUMER_KEY" = New-RandomSecret
    "MPESA_CONSUMER_SECRET" = New-RandomSecret
    "SESSION_SECRET" = New-RandomSecret
    "ENCRYPTION_KEY" = New-RandomSecret
}

foreach ($key in $secrets.Keys) {
    $secretPath = ".\secrets\$key.txt"
    $secrets[$key] | Out-File -FilePath $secretPath -NoNewline -Encoding UTF8
    Write-Host "Generated secret: $key"
}

# Create PostgreSQL configuration
$postgresConfig = @"
# PostgreSQL Configuration for Rada Development
listen_addresses = 'localhost'
port = $($config.PostgresPort)
max_connections = 100
shared_buffers = 128MB
dynamic_shared_memory_type = windows
max_wal_size = 1GB
min_wal_size = 80MB
log_timezone = 'UTC'
datestyle = 'iso, mdy'
timezone = 'UTC'
lc_messages = 'English_United States.1252'
lc_monetary = 'English_United States.1252'
lc_numeric = 'English_United States.1252'
lc_time = 'English_United States.1252'
default_text_search_config = 'pg_catalog.english'
"@

$postgresConfig | Out-File ".\config\postgresql.conf" -Encoding UTF8

# Create Redis configuration
$redisConfig = @"
port $($config.RedisPort)
bind 127.0.0.1
maxmemory 512mb
maxmemory-policy allkeys-lru
appendonly yes
"@

$redisConfig | Out-File ".\config\redis.windows.conf" -Encoding UTF8

# Create application configuration
$appConfig = @"
{
    "development": {
        "database": {
            "host": "localhost",
            "port": $($config.PostgresPort),
            "database": "rada_dev",
            "username": "postgres"
        },
        "redis": {
            "host": "localhost",
            "port": $($config.RedisPort)
        },
        "api": {
            "port": $($config.ApiPort),
            "corsOrigins": ["http://localhost:3000"]
        },
        "security": {
            "rateLimitRequests": 100,
            "rateLimitWindowMs": 900000
        }
    }
}
"@

$appConfig | Out-File ".\config\app.config.json" -Encoding UTF8

# Create database initialization script
$initDb = @"
CREATE DATABASE rada_dev;

\c rada_dev

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    amount DECIMAL(20,8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
"@

$initDb | Out-File ".\config\init.sql" -Encoding UTF8

# Create npm scripts for the project
$packageJson = @"
{
  "name": "rada-api",
  "version": "1.0.0",
  "description": "Rada Payment System API",
  "scripts": {
    "start": "node dist/server.js",
    "dev": "nodemon src/server.ts",
    "build": "tsc",
    "test": "jest",
    "lint": "eslint . --ext .ts",
    "migrate": "node-pg-migrate"
  }
}
"@

$packageJson | Out-File ".\package.json" -Encoding UTF8

# Write setup completion message
Write-Host "`nSetup completed successfully!" -ForegroundColor Green
Write-Host "`nNext steps:"
Write-Host "1. Start PostgreSQL service"
Write-Host "2. Run: psql -U postgres -f config/init.sql"
Write-Host "3. Start Redis service"
Write-Host "4. Install application dependencies: npm install"
Write-Host "5. Start the application: npm run dev"

# Create convenience script to start all services
$startScript = @"
# Start Services Script
Write-Host "Starting Rada development environment..."

# Start PostgreSQL
Write-Host "Starting PostgreSQL..."
pg_ctl -D `"$PWD\data\postgres`" -l `"$PWD\logs\postgres.log`" start

# Start Redis
Write-Host "Starting Redis..."
redis-server `"$PWD\config\redis.windows.conf`" --dir `"$PWD\data\redis`"

# Start API server
Write-Host "Starting API server..."
cd services/api-gateway
npm run dev
"@

$startScript | Out-File ".\scripts\start-dev.ps1" -Encoding UTF8

Write-Host "`nCreated start script: scripts\start-dev.ps1"
Write-Host "Run it to start all services in development mode"
