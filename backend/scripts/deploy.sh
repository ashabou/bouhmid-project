#!/bin/bash
set -e

# ========================================
# Shabou Auto Pièces - Deployment Script
# ========================================
# This script deploys the application to a remote server
#
# Usage:
#   ./deploy.sh [staging|production]
#
# Requirements:
#   - SSH access to target server
#   - Docker and Docker Compose installed on target
#   - Environment variables configured
# ========================================

ENVIRONMENT=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ========================================
# Functions
# ========================================

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking requirements..."

    if ! command -v ssh &> /dev/null; then
        log_error "ssh is not installed"
        exit 1
    fi

    if ! command -v git &> /dev/null; then
        log_error "git is not installed"
        exit 1
    fi

    log_info "✅ All requirements met"
}

load_config() {
    log_info "Loading configuration for $ENVIRONMENT..."

    if [ "$ENVIRONMENT" = "staging" ]; then
        SSH_HOST="${STAGING_HOST}"
        SSH_USER="${STAGING_USER}"
        SSH_KEY="${STAGING_SSH_KEY:-$HOME/.ssh/id_rsa}"
        DEPLOY_PATH="/opt/shabou-autopieces"
        BRANCH="main"
    elif [ "$ENVIRONMENT" = "production" ]; then
        SSH_HOST="${PRODUCTION_HOST}"
        SSH_USER="${PRODUCTION_USER}"
        SSH_KEY="${PRODUCTION_SSH_KEY:-$HOME/.ssh/id_rsa}"
        DEPLOY_PATH="/opt/shabou-autopieces"
        BRANCH="main"
    else
        log_error "Invalid environment: $ENVIRONMENT (use 'staging' or 'production')"
        exit 1
    fi

    # Validate configuration
    if [ -z "$SSH_HOST" ] || [ -z "$SSH_USER" ]; then
        log_error "Missing configuration. Set STAGING_HOST/STAGING_USER or PRODUCTION_HOST/PRODUCTION_USER"
        exit 1
    fi

    log_info "Configuration loaded:"
    log_info "  Host: $SSH_USER@$SSH_HOST"
    log_info "  Path: $DEPLOY_PATH"
    log_info "  Branch: $BRANCH"
}

test_connection() {
    log_info "Testing SSH connection..."

    if ! ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$SSH_USER@$SSH_HOST" "echo 'Connection successful'" &> /dev/null; then
        log_error "Cannot connect to $SSH_USER@$SSH_HOST"
        exit 1
    fi

    log_info "✅ SSH connection successful"
}

create_backup() {
    log_info "Creating backup on remote server..."

    ssh -i "$SSH_KEY" "$SSH_USER@$SSH_HOST" << ENDSSH
        set -e
        cd $DEPLOY_PATH

        # Create backup directory
        mkdir -p /backups

        # Backup database
        BACKUP_FILE="/backups/pre-deploy-\$(date +%Y%m%d-%H%M%S).sql"
        docker-compose exec -T postgres pg_dump -U postgres shabou_autopieces > \$BACKUP_FILE
        gzip \$BACKUP_FILE

        echo "✅ Backup created: \${BACKUP_FILE}.gz"

        # Keep only last 10 backups
        cd /backups
        ls -t pre-deploy-*.sql.gz | tail -n +11 | xargs -r rm

        echo "✅ Old backups cleaned"
ENDSSH

    log_info "✅ Backup completed"
}

deploy() {
    log_info "Starting deployment to $ENVIRONMENT..."

    ssh -i "$SSH_KEY" "$SSH_USER@$SSH_HOST" << ENDSSH
        set -e
        cd $DEPLOY_PATH

        echo "📦 Pulling latest code..."
        git fetch origin
        git checkout $BRANCH
        git pull origin $BRANCH

        echo "🔑 Logging in to container registry..."
        echo "\${GITHUB_TOKEN}" | docker login ghcr.io -u "\${GITHUB_USER}" --password-stdin

        echo "📥 Pulling latest images..."
        docker-compose pull

        echo "🗄️  Running database migrations..."
        docker-compose run --rm api npm run db:migrate:deploy

        echo "🔄 Restarting services..."
        docker-compose up -d --no-deps

        echo "🧹 Cleaning up old images..."
        docker image prune -af --filter "until=72h"

        echo "✅ Deployment completed"
ENDSSH

    log_info "✅ Deployment completed successfully"
}

health_check() {
    log_info "Running health checks..."

    if [ "$ENVIRONMENT" = "staging" ]; then
        API_URL="https://staging-api.shabouautopieces.tn"
    else
        API_URL="https://api.shabouautopieces.tn"
    fi

    # Wait for services to start
    sleep 30

    # Check API health
    if curl -f -s "${API_URL}/api/v1/health" > /dev/null; then
        log_info "✅ API health check passed"
    else
        log_error "❌ API health check failed"
        return 1
    fi

    # Check Prospector health
    if curl -f -s "${API_URL}:8001/health" > /dev/null 2>&1; then
        log_info "✅ Prospector health check passed"
    else
        log_warn "⚠️  Prospector health check failed (non-critical)"
    fi

    # Check Orion health
    if curl -f -s "${API_URL}:8002/health" > /dev/null 2>&1; then
        log_info "✅ Orion health check passed"
    else
        log_warn "⚠️  Orion health check failed (non-critical)"
    fi

    log_info "✅ Health checks completed"
}

rollback() {
    log_error "Deployment failed! Rolling back..."

    ssh -i "$SSH_KEY" "$SSH_USER@$SSH_HOST" << ENDSSH
        set -e
        cd $DEPLOY_PATH

        # Find latest backup
        LATEST_BACKUP=\$(ls -t /backups/pre-deploy-*.sql.gz | head -1)

        if [ -z "\$LATEST_BACKUP" ]; then
            echo "❌ No backup found for rollback"
            exit 1
        fi

        echo "🔄 Restoring from backup: \$LATEST_BACKUP"
        gunzip -c "\$LATEST_BACKUP" | docker-compose exec -T postgres psql -U postgres -d shabou_autopieces

        echo "🔄 Restarting services..."
        docker-compose down
        docker-compose up -d

        echo "✅ Rollback completed"
ENDSSH

    log_info "✅ Rollback completed"
    exit 1
}

show_usage() {
    echo "Usage: $0 [staging|production]"
    echo ""
    echo "Environment variables required:"
    echo "  For staging:"
    echo "    STAGING_HOST     - Staging server hostname/IP"
    echo "    STAGING_USER     - SSH username for staging"
    echo "    STAGING_SSH_KEY  - Path to SSH private key (optional, defaults to ~/.ssh/id_rsa)"
    echo ""
    echo "  For production:"
    echo "    PRODUCTION_HOST     - Production server hostname/IP"
    echo "    PRODUCTION_USER     - SSH username for production"
    echo "    PRODUCTION_SSH_KEY  - Path to SSH private key (optional, defaults to ~/.ssh/id_rsa)"
    echo ""
    echo "Example:"
    echo "  STAGING_HOST=staging.example.com STAGING_USER=deploy ./deploy.sh staging"
}

# ========================================
# Main Script
# ========================================

main() {
    if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        show_usage
        exit 0
    fi

    log_info "========================================="
    log_info "Shabou Auto Pièces - Deployment Script"
    log_info "Environment: $ENVIRONMENT"
    log_info "========================================="

    check_requirements
    load_config
    test_connection

    # Confirm deployment
    read -p "Deploy to $ENVIRONMENT? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warn "Deployment cancelled"
        exit 0
    fi

    # Run deployment steps
    create_backup
    deploy || rollback

    # Health checks
    if ! health_check; then
        log_error "Health checks failed!"
        read -p "Rollback? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rollback
        fi
        exit 1
    fi

    log_info "========================================="
    log_info "✅ Deployment to $ENVIRONMENT completed successfully!"
    log_info "========================================="
}

# Run main function
main "$@"
