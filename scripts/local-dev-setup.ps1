# Local Development Environment Setup
# Configuration for Windows without Docker

# Database Configuration
$PostgreSQLConfig = @"
# PostgreSQL Configuration for Rada
# Save as postgresql.conf in your PostgreSQL data directory

listen_addresses = 'localhost'
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

# Redis Windows Service Configuration
$RedisConfig = @"
# Redis Windows Configuration
port 6379
bind 127.0.0.1
maxmemory 512mb
maxmemory-policy allkeys-lru
appendonly yes
"@

# Node.js Services Configuration
$NodeConfig = @"
{
    "api": {
        "port": 8080,
        "env": "development",
        "database": {
            "host": "localhost",
            "port": 5432,
            "database": "rada",
            "username": "postgres"
        },
        "redis": {
            "host": "localhost",
            "port": 6379
        }
    },
    "worker": {
        "port": 8081,
        "env": "development",
        "queues": ["payments", "notifications"]
    }
}
"@

# Create configuration directory
New-Item -ItemType Directory -Path ".\config\local" -Force

# Save configurations
$PostgreSQLConfig | Set-Content ".\config\local\postgresql.conf"
$RedisConfig | Set-Content ".\config\local\redis.windows.conf"
$NodeConfig | Set-Content ".\config\local\services.json"

# Create development environment setup script
$setupScript = @"
# Rada Development Environment Setup Script
# Run this script to configure your local development environment

# Check for required tools
function Test-Command(`$cmdName) {
    return [bool](Get-Command -Name `$cmdName -ErrorAction SilentlyContinue)
}

# Required tools
`$requiredTools = @{
    "node" = "Node.js"
    "npm" = "NPM"
    "pg_ctl" = "PostgreSQL"
    "redis-server" = "Redis"
}

# Check each tool
`$missingTools = @()
foreach (`$tool in `$requiredTools.GetEnumerator()) {
    if (-not (Test-Command `$tool.Key)) {
        `$missingTools += `$tool.Value
    }
}

if (`$missingTools.Count -gt 0) {
    Write-Host "Missing required tools: `$(`$missingTools -join ', ')"
    Write-Host "Please install the missing tools and run this script again."
    exit 1
}

# Create development database
`$env:PGPASSWORD = 'your_password_here'
psql -U postgres -c "CREATE DATABASE rada_dev;"

# Install application dependencies
Push-Location ".\services\api-gateway"
npm install
Pop-Location

Push-Location ".\services\worker"
npm install
Pop-Location

Push-Location ".\mobile-app"
npm install
Pop-Location

# Create local SSL certificates for development
if (-not (Test-Path ".\certificates")) {
    New-Item -ItemType Directory -Path ".\certificates"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
        -keyout ".\certificates\local-key.pem" `
        -out ".\certificates\local-cert.pem" `
        -subj "/CN=localhost"
}

Write-Host "`nDevelopment environment setup completed!"
Write-Host "To start the development environment:"
Write-Host "1. Start PostgreSQL"
Write-Host "2. Start Redis"
Write-Host "3. Run 'npm run dev' in the api-gateway directory"
Write-Host "4. Run 'npm run dev' in the worker directory"
Write-Host "5. Run 'npm start' in the mobile-app directory"
"@

$setupScript | Set-Content ".\scripts\setup-dev-environment.ps1"

Write-Host "Local development environment configuration created successfully!"
Write-Host "Next steps:"
Write-Host "1. Install PostgreSQL for Windows"
Write-Host "2. Install Redis for Windows"
Write-Host "3. Run setup-dev-environment.ps1 to configure your development environment"
