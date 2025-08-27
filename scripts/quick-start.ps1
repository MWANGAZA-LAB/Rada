# Rada Payment System - Quick Start Script for Windows
# This script sets up and starts the development environment

param(
    [string]$Environment = "development"
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"

# Logging functions
function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor $Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Yellow
}

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Log "Starting Rada Payment System Quick Start..."
Write-Log "Environment: $Environment"
Write-Log "Project root: $ProjectRoot"

# Check if Docker is installed
Write-Log "Checking Docker installation..."
try {
    $dockerVersion = docker --version
    Write-Success "Docker found: $dockerVersion"
} catch {
    Write-Error "Docker is not installed or not in PATH"
    Write-Host "Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    exit 1
}

# Check if Docker is running
Write-Log "Checking if Docker is running..."
try {
    docker info | Out-Null
    Write-Success "Docker is running"
} catch {
    Write-Error "Docker is not running"
    Write-Host "Please start Docker Desktop"
    exit 1
}

# Check if Docker Compose is available
Write-Log "Checking Docker Compose..."
try {
    $composeVersion = docker-compose --version
    Write-Success "Docker Compose found: $composeVersion"
} catch {
    Write-Error "Docker Compose is not available"
    Write-Host "Please ensure Docker Compose is installed"
    exit 1
}

# Set environment file
$EnvFile = "$ProjectRoot\env.$Environment"
$EnvFileTarget = "$ProjectRoot\.env.$Environment"

# Check if environment file exists
if (-not (Test-Path $EnvFile)) {
    Write-Error "Environment file not found: $EnvFile"
    Write-Host "Please ensure the environment file exists"
    exit 1
}

# Copy environment file if target doesn't exist
if (-not (Test-Path $EnvFileTarget)) {
    Write-Log "Copying environment file..."
    Copy-Item $EnvFile $EnvFileTarget
    Write-Success "Environment file copied"
} else {
    Write-Warning "Environment file already exists: $EnvFileTarget"
}

# Create necessary directories
Write-Log "Creating necessary directories..."
$directories = @(
    "$ProjectRoot\logs",
    "$ProjectRoot\logs\nginx",
    "$ProjectRoot\backups",
    "$ProjectRoot\nginx\ssl"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Success "Created directory: $dir"
    }
}

# Generate SSL certificates for development
if ($Environment -eq "development") {
    Write-Log "Generating SSL certificates for development..."
    $sslCert = "$ProjectRoot\nginx\ssl\rada.crt"
    $sslKey = "$ProjectRoot\nginx\ssl\rada.key"
    
    if (-not (Test-Path $sslCert) -or -not (Test-Path $sslKey)) {
        try {
            # Check if OpenSSL is available
            $opensslVersion = openssl version
            Write-Success "OpenSSL found: $opensslVersion"
            
            # Generate self-signed certificate
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
                -keyout $sslKey `
                -out $sslCert `
                -subj "/C=KE/ST=Nairobi/L=Nairobi/O=Rada/OU=IT/CN=localhost"
            
            Write-Success "SSL certificates generated"
        } catch {
            Write-Warning "OpenSSL not found, skipping SSL certificate generation"
            Write-Host "You may need to install OpenSSL or generate certificates manually"
        }
    } else {
        Write-Warning "SSL certificates already exist"
    }
}

# Set compose file
$ComposeFile = "docker-compose.$Environment.yml"
if ($Environment -eq "development") {
    $ComposeFile = "docker-compose.yml"
}

# Check if compose file exists
if (-not (Test-Path "$ProjectRoot\$ComposeFile")) {
    Write-Error "Docker Compose file not found: $ComposeFile"
    exit 1
}

# Stop existing containers
Write-Log "Stopping existing containers..."
try {
    docker-compose -f "$ProjectRoot\$ComposeFile" down --remove-orphans
    Write-Success "Existing containers stopped"
} catch {
    Write-Warning "No existing containers to stop"
}

# Build and start services
Write-Log "Building and starting services..."
try {
    # Build images
    docker-compose -f "$ProjectRoot\$ComposeFile" build
    
    # Start services
    docker-compose -f "$ProjectRoot\$ComposeFile" up -d
    
    Write-Success "Services started successfully"
} catch {
    Write-Error "Failed to start services"
    Write-Host "Error: $($_.Exception.Message)"
    exit 1
}

# Wait for services to be ready
Write-Log "Waiting for services to be ready..."
Start-Sleep -Seconds 10

# Check service status
Write-Log "Checking service status..."
try {
    docker-compose -f "$ProjectRoot\$ComposeFile" ps
} catch {
    Write-Warning "Could not display service status"
}

# Show access information
Write-Host ""
Write-Success "Rada Payment System is now running!"
Write-Host ""
Write-Host "Access URLs:"
Write-Host "  - API Gateway: http://localhost:3000"
Write-Host "  - Health Check: http://localhost/health"
if ($Environment -eq "development") {
    Write-Host "  - HTTPS: https://localhost"
}
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  - View logs: docker-compose -f $ComposeFile logs -f"
Write-Host "  - Stop services: docker-compose -f $ComposeFile down"
Write-Host "  - Restart services: docker-compose -f $ComposeFile restart"
Write-Host ""

# Test health endpoint
Write-Log "Testing health endpoint..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Success "Health check passed"
    } else {
        Write-Warning "Health check returned status: $($response.StatusCode)"
    }
} catch {
    Write-Warning "Health check failed: $($_.Exception.Message)"
    Write-Host "Services may still be starting up. Please wait a few minutes and try again."
}

Write-Host ""
Write-Success "Quick start completed!"
Write-Host "For more information, see DEPLOYMENT.md"
