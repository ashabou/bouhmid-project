#!/bin/bash
set -e

# ========================================
# Shabou Auto Pièces - Rollback Script
# ========================================
# Rolls back to a previous backup
#
# Usage:
#   ./rollback.sh [staging|production] [backup-file]
#
# If backup-file is not specified, uses the most recent backup
# ========================================

ENVIRONMENT=${1:-staging}
BACKUP_FILE=$2

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

load_config() {
    log_info "Loading configuration for $ENVIRONMENT..."

    if [ "$ENVIRONMENT" = "staging" ]; then
        SSH_HOST="${STAGING_HOST}"
        SSH_USER="${STAGING_USER}"
        SSH_KEY="${STAGING_SSH_KEY:-$HOME/.ssh/id_rsa}"
        DEPLOY_PATH="/opt/shabou-autopieces"
    elif [ "$ENVIRONMENT" = "production" ]; then
        SSH_HOST="${PRODUCTION_HOST}"
        SSH_USER="${PRODUCTION_USER}"
        SSH_KEY="${PRODUCTION_SSH_KEY:-$HOME/.ssh/id_rsa}"
        DEPLOY_PATH="/opt/shabou-autopieces"
    else
        log_error "Invalid environment: $ENVIRONMENT"
        exit 1
    fi

    if [ -z "$SSH_HOST" ] || [ -z "$SSH_USER" ]; then
        log_error "Missing configuration"
        exit 1
    fi
}

list_backups() {
    log_info "Available backups:"

    ssh -i "$SSH_KEY" "$SSH_USER@$SSH_HOST" << 'ENDSSH'
        if [ ! -d /backups ]; then
            echo "No backups directory found"
            exit 1
        fi

        cd /backups
        ls -lht pre-deploy-*.sql.gz 2>/dev/null | head -10 || echo "No backups found"
ENDSSH
}

create_pre_rollback_backup() {
    log_info "Creating backup before rollback..."

    ssh -i "$SSH_KEY" "$SSH_USER@$SSH_HOST" << ENDSSH
        set -e
        cd $DEPLOY_PATH

        mkdir -p /backups
        BACKUP_FILE="/backups/pre-rollback-\$(date +%Y%m%d-%H%M%S).sql"
        docker-compose exec -T postgres pg_dump -U postgres shabou_autopieces > \$BACKUP_FILE
        gzip \$BACKUP_FILE

        echo "✅ Pre-rollback backup created: \${BACKUP_FILE}.gz"
ENDSSH

    log_info "✅ Pre-rollback backup completed"
}

perform_rollback() {
    log_info "Performing rollback..."

    ssh -i "$SSH_KEY" "$SSH_USER@$SSH_HOST" << ENDSSH
        set -e
        cd $DEPLOY_PATH

        # Determine which backup to use
        if [ -n "$BACKUP_FILE" ]; then
            RESTORE_FILE="$BACKUP_FILE"
        else
            # Use most recent pre-deploy backup
            RESTORE_FILE=\$(ls -t /backups/pre-deploy-*.sql.gz | head -1)
        fi

        if [ -z "\$RESTORE_FILE" ] || [ ! -f "\$RESTORE_FILE" ]; then
            echo "❌ Backup file not found"
            exit 1
        fi

        echo "🔄 Restoring from: \$RESTORE_FILE"

        # Stop services
        echo "⏸️  Stopping services..."
        docker-compose down

        # Restore database
        echo "🗄️  Restoring database..."
        docker-compose up -d postgres redis
        sleep 10

        gunzip -c "\$RESTORE_FILE" | docker-compose exec -T postgres psql -U postgres -d shabou_autopieces

        # Restart all services
        echo "▶️  Restarting services..."
        docker-compose up -d

        echo "✅ Rollback completed"
ENDSSH

    log_info "✅ Rollback completed"
}

verify_rollback() {
    log_info "Verifying rollback..."

    sleep 30

    if [ "$ENVIRONMENT" = "staging" ]; then
        API_URL="https://staging-api.shabouautopieces.tn"
    else
        API_URL="https://api.shabouautopieces.tn"
    fi

    if curl -f -s "${API_URL}/api/v1/health" > /dev/null; then
        log_info "✅ Services are healthy after rollback"
    else
        log_error "❌ Services are not healthy after rollback"
        exit 1
    fi
}

show_usage() {
    echo "Usage: $0 [staging|production] [backup-file]"
    echo ""
    echo "If backup-file is not specified, the most recent pre-deploy backup will be used"
    echo ""
    echo "Environment variables required:"
    echo "  For staging:"
    echo "    STAGING_HOST     - Staging server hostname/IP"
    echo "    STAGING_USER     - SSH username"
    echo "    STAGING_SSH_KEY  - Path to SSH private key (optional)"
    echo ""
    echo "  For production:"
    echo "    PRODUCTION_HOST     - Production server hostname/IP"
    echo "    PRODUCTION_USER     - SSH username"
    echo "    PRODUCTION_SSH_KEY  - Path to SSH private key (optional)"
    echo ""
    echo "Example:"
    echo "  ./rollback.sh staging"
    echo "  ./rollback.sh production /backups/pre-deploy-20231115-143022.sql.gz"
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
    log_info "Shabou Auto Pièces - Rollback Script"
    log_info "Environment: $ENVIRONMENT"
    log_info "========================================="

    load_config
    list_backups

    # Confirm rollback
    log_warn "⚠️  WARNING: This will restore the database from a backup"
    log_warn "⚠️  Any data created after the backup will be LOST"
    echo ""
    read -p "Continue with rollback? (yes/NO) " -r
    echo

    if [ "$REPLY" != "yes" ]; then
        log_warn "Rollback cancelled"
        exit 0
    fi

    create_pre_rollback_backup
    perform_rollback
    verify_rollback

    log_info "========================================="
    log_info "✅ Rollback completed successfully!"
    log_info "========================================="
}

# Run main function
main "$@"
