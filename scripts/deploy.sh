#!/bin/bash

# Rada Payment System Deployment Script
# This script handles the complete deployment process for the Rada payment system

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-production}"
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Load environment variables
load_environment() {
    log "Loading environment variables..."
    
    if [[ ! -f "$PROJECT_ROOT/.env.${ENVIRONMENT}" ]]; then
        error "Environment file .env.${ENVIRONMENT} not found"
        exit 1
    fi
    
    export $(grep -v '^#' "$PROJECT_ROOT/.env.${ENVIRONMENT}" | xargs)
    success "Environment variables loaded"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p "$PROJECT_ROOT/logs"
    mkdir -p "$PROJECT_ROOT/logs/nginx"
    mkdir -p "$PROJECT_ROOT/backups"
    mkdir -p "$PROJECT_ROOT/nginx/ssl"
    
    success "Directories created"
}

# Generate SSL certificates (for development)
generate_ssl_certificates() {
    if [[ "$ENVIRONMENT" == "development" ]]; then
        log "Generating SSL certificates for development..."
        
        if [[ ! -f "$PROJECT_ROOT/nginx/ssl/rada.crt" ]] || [[ ! -f "$PROJECT_ROOT/nginx/ssl/rada.key" ]]; then
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout "$PROJECT_ROOT/nginx/ssl/rada.key" \
                -out "$PROJECT_ROOT/nginx/ssl/rada.crt" \
                -subj "/C=KE/ST=Nairobi/L=Nairobi/O=Rada/OU=IT/CN=localhost"
            
            success "SSL certificates generated"
        else
            warning "SSL certificates already exist"
        fi
    fi
}

# Backup database (if exists)
backup_database() {
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log "Creating database backup..."
        
        BACKUP_FILE="$PROJECT_ROOT/backups/backup_$(date +%Y%m%d_%H%M%S).sql"
        
        if docker ps -q -f name=rada-postgres-prod | grep -q .; then
            docker exec rada-postgres-prod pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_FILE"
            success "Database backup created: $BACKUP_FILE"
        else
            warning "Database container not running, skipping backup"
        fi
    fi
}

# Stop existing containers
stop_containers() {
    log "Stopping existing containers..."
    
    if [[ -f "$PROJECT_ROOT/$COMPOSE_FILE" ]]; then
        docker-compose -f "$COMPOSE_FILE" down --remove-orphans
        success "Existing containers stopped"
    else
        warning "Compose file $COMPOSE_FILE not found"
    fi
}

# Build Docker images
build_images() {
    log "Building Docker images..."
    
    # Build API Gateway
    log "Building API Gateway..."
    docker-compose -f "$COMPOSE_FILE" build api-gateway
    
    # Build other services if they exist
    for service in mpesa-service lightning-service exchange-service notification-service; do
        if [[ -d "$PROJECT_ROOT/services/$service" ]]; then
            log "Building $service..."
            docker-compose -f "$COMPOSE_FILE" build "$service"
        fi
    done
    
    success "Docker images built"
}

# Start services
start_services() {
    log "Starting services..."
    
    docker-compose -f "$COMPOSE_FILE" up -d
    
    success "Services started"
}

# Wait for services to be healthy
wait_for_health() {
    log "Waiting for services to be healthy..."
    
    # Wait for database
    log "Waiting for database..."
    timeout=60
    while [[ $timeout -gt 0 ]]; do
        if docker exec rada-postgres-${ENVIRONMENT} pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" &> /dev/null; then
            success "Database is healthy"
            break
        fi
        sleep 5
        timeout=$((timeout - 5))
    done
    
    if [[ $timeout -le 0 ]]; then
        error "Database health check failed"
        exit 1
    fi
    
    # Wait for Redis
    log "Waiting for Redis..."
    timeout=30
    while [[ $timeout -gt 0 ]]; do
        if docker exec rada-redis-${ENVIRONMENT} redis-cli ping &> /dev/null; then
            success "Redis is healthy"
            break
        fi
        sleep 5
        timeout=$((timeout - 5))
    done
    
    if [[ $timeout -le 0 ]]; then
        error "Redis health check failed"
        exit 1
    fi
    
    # Wait for API Gateway
    log "Waiting for API Gateway..."
    timeout=60
    while [[ $timeout -gt 0 ]]; do
        if curl -f http://localhost:3000/health &> /dev/null; then
            success "API Gateway is healthy"
            break
        fi
        sleep 5
        timeout=$((timeout - 5))
    done
    
    if [[ $timeout -le 0 ]]; then
        error "API Gateway health check failed"
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Check if migrations need to be run
    if docker exec rada-api-gateway-${ENVIRONMENT} node -e "
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        pool.query('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = \'public\'')
            .then(result => {
                if (parseInt(result.rows[0].count) === 0) {
                    console.log('MIGRATIONS_NEEDED');
                } else {
                    console.log('MIGRATIONS_NOT_NEEDED');
                }
                process.exit(0);
            })
            .catch(err => {
                console.error(err);
                process.exit(1);
            });
    " | grep -q "MIGRATIONS_NEEDED"; then
        
        log "Running initial database setup..."
        docker exec rada-postgres-${ENVIRONMENT} psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/01-schema.sql
        
        if [[ -f "$PROJECT_ROOT/database/seed.sql" ]]; then
            log "Running database seeding..."
            docker exec rada-postgres-${ENVIRONMENT} psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/02-seed.sql
        fi
        
        success "Database migrations completed"
    else
        success "Database migrations not needed"
    fi
}

# Run health checks
run_health_checks() {
    log "Running comprehensive health checks..."
    
    # Check all services
    services=("api-gateway" "mpesa-service" "lightning-service" "exchange-service" "notification-service")
    
    for service in "${services[@]}"; do
        if [[ -d "$PROJECT_ROOT/services/$service" ]]; then
            log "Checking $service..."
            if curl -f "http://localhost:${service#*-}/health" &> /dev/null; then
                success "$service is healthy"
            else
                error "$service health check failed"
                return 1
            fi
        fi
    done
    
    # Check Nginx
    log "Checking Nginx..."
    if curl -f http://localhost/health &> /dev/null; then
        success "Nginx is healthy"
    else
        error "Nginx health check failed"
        return 1
    fi
    
    success "All health checks passed"
}

# Show deployment status
show_status() {
    log "Deployment Status:"
    echo ""
    docker-compose -f "$COMPOSE_FILE" ps
    echo ""
    
    log "Service URLs:"
    echo "  - API Gateway: http://localhost:3000"
    echo "  - M-Pesa Service: http://localhost:3001"
    echo "  - Lightning Service: http://localhost:3002"
    echo "  - Exchange Service: http://localhost:3003"
    echo "  - Notification Service: http://localhost:3004"
    echo "  - Nginx (Main): http://localhost"
    echo "  - Health Check: http://localhost/health"
    echo ""
    
    if [[ "$ENVIRONMENT" == "development" ]]; then
        echo "  - HTTPS: https://localhost"
    fi
}

# Main deployment function
main() {
    log "Starting Rada Payment System deployment..."
    log "Environment: $ENVIRONMENT"
    log "Project root: $PROJECT_ROOT"
    
    check_root
    check_prerequisites
    load_environment
    create_directories
    generate_ssl_certificates
    backup_database
    stop_containers
    build_images
    start_services
    wait_for_health
    run_migrations
    run_health_checks
    show_status
    
    success "Deployment completed successfully!"
    log "You can now access the Rada Payment System at http://localhost"
}

# Handle script arguments
case "${1:-}" in
    "development"|"production")
        main
        ;;
    "help"|"-h"|"--help")
        echo "Usage: $0 [environment]"
        echo ""
        echo "Environments:"
        echo "  development  - Deploy development environment"
        echo "  production   - Deploy production environment (default)"
        echo ""
        echo "Examples:"
        echo "  $0 development"
        echo "  $0 production"
        ;;
    *)
        if [[ -n "${1:-}" ]]; then
            error "Invalid environment: $1"
            echo "Use '$0 help' for usage information"
            exit 1
        else
            main
        fi
        ;;
esac
