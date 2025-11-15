#!/bin/bash
# ========================================
# Shabou Auto Pièces - Backup Script
# Complete backup solution for database and files
# ========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BACKUP_DIR="/var/backups/shabou-autopieces"
APP_DIR="/var/www/shabou-autopieces"
DB_NAME="${DB_NAME:-shabou_autopieces}"
DB_USER="${DB_USER:-shabou_user}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DATE_DIR=$(date +%Y/%m/%d)

# S3 Configuration (optional)
S3_BUCKET="${S3_BUCKET:-}"
S3_ENABLED="${S3_ENABLED:-false}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Shabou Auto Pièces - Backup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Timestamp: $TIMESTAMP"
echo "Retention: $RETENTION_DAYS days"
echo ""

# Create backup directories
mkdir -p "$BACKUP_DIR/database/$DATE_DIR"
mkdir -p "$BACKUP_DIR/files/$DATE_DIR"
mkdir -p "$BACKUP_DIR/configs/$DATE_DIR"

#==========================================
# Database Backup
# ========================================
backup_database() {
  echo -e "${YELLOW}Backing up database...${NC}"

  local DB_BACKUP="$BACKUP_DIR/database/$DATE_DIR/shabou-db-$TIMESTAMP.sql.gz"

  # Backup with pg_dump
  PGPASSWORD="$DB_PASSWORD" pg_dump \
    -U "$DB_USER" \
    -h localhost \
    "$DB_NAME" \
    --format=custom \
    --compress=9 \
    --file="$DB_BACKUP.custom" \
    2>/dev/null

  # Also create plain SQL for easy restore
  PGPASSWORD="$DB_PASSWORD" pg_dump \
    -U "$DB_USER" \
    -h localhost \
    "$DB_NAME" \
    | gzip > "$DB_BACKUP"

  local DB_SIZE=$(du -h "$DB_BACKUP" | cut -f1)
  echo -e "${GREEN}✓ Database backed up: $DB_BACKUP ($DB_SIZE)${NC}"

  # Create checksum
  sha256sum "$DB_BACKUP" > "$DB_BACKUP.sha256"
}

# ========================================
# File Backup
# ========================================
backup_files() {
  echo ""
  echo -e "${YELLOW}Backing up application files...${NC}"

  local FILES_BACKUP="$BACKUP_DIR/files/$DATE_DIR/shabou-files-$TIMESTAMP.tar.gz"

  # Backup uploads, logs, and other important files
  tar -czf "$FILES_BACKUP" \
    -C "$APP_DIR" \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='dist' \
    --exclude='build' \
    backend/uploads \
    backend/logs \
    frontend/public/uploads \
    2>/dev/null || true

  local FILES_SIZE=$(du -h "$FILES_BACKUP" | cut -f1)
  echo -e "${GREEN}✓ Files backed up: $FILES_BACKUP ($FILES_SIZE)${NC}"

  # Create checksum
  sha256sum "$FILES_BACKUP" > "$FILES_BACKUP.sha256"
}

# ========================================
# Configuration Backup
# ========================================
backup_configs() {
  echo ""
  echo -e "${YELLOW}Backing up configurations...${NC}"

  local CONFIG_BACKUP="$BACKUP_DIR/configs/$DATE_DIR/shabou-configs-$TIMESTAMP.tar.gz"

  # Backup configuration files
  tar -czf "$CONFIG_BACKUP" \
    /etc/nginx/sites-available/shabou-autopieces.conf \
    /etc/letsencrypt \
    /root/.shabou-db.env \
    "$APP_DIR/backend/.env" \
    "$APP_DIR/backend/docker-compose.yml" \
    2>/dev/null || true

  local CONFIG_SIZE=$(du -h "$CONFIG_BACKUP" | cut -f1)
  echo -e "${GREEN}✓ Configurations backed up: $CONFIG_BACKUP ($CONFIG_SIZE)${NC}"

  # Create checksum
  sha256sum "$CONFIG_BACKUP" > "$CONFIG_BACKUP.sha256"
}

# ========================================
# Upload to S3 (optional)
# ========================================
upload_to_s3() {
  if [ "$S3_ENABLED" != "true" ] || [ -z "$S3_BUCKET" ]; then
    echo ""
    echo -e "${YELLOW}S3 upload disabled${NC}"
    return
  fi

  echo ""
  echo -e "${YELLOW}Uploading to S3...${NC}"

  # Upload database backup
  aws s3 cp \
    "$BACKUP_DIR/database/$DATE_DIR/" \
    "s3://$S3_BUCKET/backups/shabou-autopieces/database/$DATE_DIR/" \
    --recursive \
    --storage-class STANDARD_IA

  # Upload files backup
  aws s3 cp \
    "$BACKUP_DIR/files/$DATE_DIR/" \
    "s3://$S3_BUCKET/backups/shabou-autopieces/files/$DATE_DIR/" \
    --recursive \
    --storage-class STANDARD_IA

  # Upload configs backup
  aws s3 cp \
    "$BACKUP_DIR/configs/$DATE_DIR/" \
    "s3://$S3_BUCKET/backups/shabou-autopieces/configs/$DATE_DIR/" \
    --recursive \
    --storage-class STANDARD_IA

  echo -e "${GREEN}✓ Uploaded to S3: s3://$S3_BUCKET/backups/shabou-autopieces/${NC}"
}

# ========================================
# Cleanup Old Backups
# ========================================
cleanup_old_backups() {
  echo ""
  echo -e "${YELLOW}Cleaning up old backups...${NC}"

  # Remove backups older than retention period
  local DELETED_COUNT=0

  # Database backups
  DELETED_COUNT=$(find "$BACKUP_DIR/database" -name "shabou-db-*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
  echo -e "${GREEN}✓ Deleted $DELETED_COUNT old database backup(s)${NC}"

  # File backups
  DELETED_COUNT=$(find "$BACKUP_DIR/files" -name "shabou-files-*.tar.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
  echo -e "${GREEN}✓ Deleted $DELETED_COUNT old file backup(s)${NC}"

  # Config backups
  DELETED_COUNT=$(find "$BACKUP_DIR/configs" -name "shabou-configs-*.tar.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
  echo -e "${GREEN}✓ Deleted $DELETED_COUNT old config backup(s)${NC}"
}

# ========================================
# Create Backup Manifest
# ========================================
create_manifest() {
  echo ""
  echo -e "${YELLOW}Creating backup manifest...${NC}"

  local MANIFEST="$BACKUP_DIR/manifest-$TIMESTAMP.json"

  cat > "$MANIFEST" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "date": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "database": {
    "name": "$DB_NAME",
    "file": "database/$DATE_DIR/shabou-db-$TIMESTAMP.sql.gz",
    "size": "$(stat -f%z "$BACKUP_DIR/database/$DATE_DIR/shabou-db-$TIMESTAMP.sql.gz" 2>/dev/null || stat -c%s "$BACKUP_DIR/database/$DATE_DIR/shabou-db-$TIMESTAMP.sql.gz")"
  },
  "files": {
    "file": "files/$DATE_DIR/shabou-files-$TIMESTAMP.tar.gz",
    "size": "$(stat -f%z "$BACKUP_DIR/files/$DATE_DIR/shabou-files-$TIMESTAMP.tar.gz" 2>/dev/null || stat -c%s "$BACKUP_DIR/files/$DATE_DIR/shabou-files-$TIMESTAMP.tar.gz")"
  },
  "configs": {
    "file": "configs/$DATE_DIR/shabou-configs-$TIMESTAMP.tar.gz",
    "size": "$(stat -f%z "$BACKUP_DIR/configs/$DATE_DIR/shabou-configs-$TIMESTAMP.tar.gz" 2>/dev/null || stat -c%s "$BACKUP_DIR/configs/$DATE_DIR/shabou-configs-$TIMESTAMP.tar.gz")"
  },
  "s3_upload": $S3_ENABLED,
  "retention_days": $RETENTION_DAYS
}
EOF

  echo -e "${GREEN}✓ Manifest created: $MANIFEST${NC}"
}

# ========================================
# Send Notification (optional)
# ========================================
send_notification() {
  local STATUS=$1
  local MESSAGE=$2

  # Skip if no webhook configured
  if [ -z "$SLACK_WEBHOOK_URL" ]; then
    return
  fi

  local COLOR="good"
  if [ "$STATUS" != "success" ]; then
    COLOR="danger"
  fi

  curl -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{
      \"attachments\": [{
        \"color\": \"$COLOR\",
        \"title\": \"Shabou Auto Pièces Backup\",
        \"text\": \"$MESSAGE\",
        \"fields\": [
          {\"title\": \"Timestamp\", \"value\": \"$TIMESTAMP\", \"short\": true},
          {\"title\": \"Host\", \"value\": \"$(hostname)\", \"short\": true}
        ]
      }]
    }" 2>/dev/null || true
}

# ========================================
# Main Execution
# ========================================
main() {
  local START_TIME=$(date +%s)

  # Check if running as root
  if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    exit 1
  fi

  # Run backups
  backup_database
  backup_files
  backup_configs
  upload_to_s3
  create_manifest
  cleanup_old_backups

  local END_TIME=$(date +%s)
  local DURATION=$((END_TIME - START_TIME))

  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}Backup Complete!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo "Duration: ${DURATION}s"
  echo "Location: $BACKUP_DIR"
  echo ""
  echo "Latest backups:"
  echo "  Database: database/$DATE_DIR/shabou-db-$TIMESTAMP.sql.gz"
  echo "  Files: files/$DATE_DIR/shabou-files-$TIMESTAMP.tar.gz"
  echo "  Configs: configs/$DATE_DIR/shabou-configs-$TIMESTAMP.tar.gz"
  echo ""

  # Send success notification
  send_notification "success" "Backup completed successfully in ${DURATION}s"

  # Log to syslog
  logger "Shabou Auto Pièces backup completed successfully (Duration: ${DURATION}s)"
}

# Trap errors
trap 'send_notification "error" "Backup failed"; exit 1' ERR

# Run main function
main
