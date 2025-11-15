#!/bin/bash
# ========================================
# Production Database Setup Script
# Setup PostgreSQL for Shabou Auto Pièces
# ========================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
DB_NAME="${DB_NAME:-shabou_autopieces}"
DB_USER="${DB_USER:-shabou_user}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
POSTGRES_VERSION="${POSTGRES_VERSION:-15}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Production Database Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root${NC}"
  exit 1
fi

# Generate secure password if not provided
if [ -z "$DB_PASSWORD" ]; then
  echo -e "${YELLOW}Generating secure database password...${NC}"
  DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
  echo -e "${GREEN}Generated password: ${YELLOW}$DB_PASSWORD${NC}"
  echo -e "${YELLOW}⚠ Save this password securely!${NC}"
fi

# Install PostgreSQL
install_postgresql() {
  echo ""
  echo -e "${YELLOW}Installing PostgreSQL $POSTGRES_VERSION...${NC}"

  if command -v psql >/dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is already installed${NC}"
    psql --version
    return
  fi

  # Detect OS and install
  if [ -f /etc/debian_version ]; then
    # Debian/Ubuntu
    apt-get update
    apt-get install -y wget ca-certificates

    # Add PostgreSQL repository
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
    echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list

    apt-get update
    apt-get install -y postgresql-$POSTGRES_VERSION postgresql-contrib-$POSTGRES_VERSION

  elif [ -f /etc/redhat-release ]; then
    # RHEL/CentOS
    yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-$(rpm -E %{rhel})-x86_64/pgdg-redhat-repo-latest.noarch.rpm
    yum install -y postgresql$POSTGRES_VERSION-server postgresql$POSTGRES_VERSION-contrib

    # Initialize database
    /usr/pgsql-$POSTGRES_VERSION/bin/postgresql-$POSTGRES_VERSION-setup initdb
  else
    echo -e "${RED}Error: Unsupported OS${NC}"
    exit 1
  fi

  echo -e "${GREEN}✓ PostgreSQL installed successfully${NC}"
}

# Configure PostgreSQL
configure_postgresql() {
  echo ""
  echo -e "${YELLOW}Configuring PostgreSQL...${NC}"

  local PG_CONF="/etc/postgresql/$POSTGRES_VERSION/main/postgresql.conf"
  local PG_HBA="/etc/postgresql/$POSTGRES_VERSION/main/pg_hba.conf"

  # Backup original files
  if [ -f "$PG_CONF" ]; then
    cp "$PG_CONF" "$PG_CONF.backup.$(date +%Y%m%d-%H%M%S)"
  fi

  if [ -f "$PG_HBA" ]; then
    cp "$PG_HBA" "$PG_HBA.backup.$(date +%Y%m%d-%H%M%S)"
  fi

  # Performance tuning (adjust based on server resources)
  cat >> "$PG_CONF" <<EOF

# Shabou Auto Pièces - Performance Tuning
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 2621kB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
max_parallel_maintenance_workers = 2
EOF

  # Configure authentication
  cat >> "$PG_HBA" <<EOF

# Shabou Auto Pièces - Local connections
local   $DB_NAME    $DB_USER                            scram-sha-256
host    $DB_NAME    $DB_USER    127.0.0.1/32            scram-sha-256
host    $DB_NAME    $DB_USER    ::1/128                 scram-sha-256
EOF

  echo -e "${GREEN}✓ PostgreSQL configured${NC}"
}

# Create database and user
create_database() {
  echo ""
  echo -e "${YELLOW}Creating database and user...${NC}"

  # Start PostgreSQL
  systemctl start postgresql
  systemctl enable postgresql

  # Create user and database
  sudo -u postgres psql <<EOF
-- Create user
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';

-- Create database
CREATE DATABASE $DB_NAME OWNER $DB_USER;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Connect to database and setup extensions
\c $DB_NAME

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
EOF

  echo -e "${GREEN}✓ Database and user created${NC}"
}

# Setup backups
setup_backups() {
  echo ""
  echo -e "${YELLOW}Setting up automated backups...${NC}"

  # Create backup directory
  mkdir -p /var/backups/postgresql
  chown postgres:postgres /var/backups/postgresql
  chmod 700 /var/backups/postgresql

  # Create backup script
  cat > /usr/local/bin/backup-shabou-db.sh <<'BACKUP_SCRIPT'
#!/bin/bash
# Automated PostgreSQL backup for Shabou Auto Pièces

BACKUP_DIR="/var/backups/postgresql"
DB_NAME="shabou_autopieces"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/shabou-$TIMESTAMP.sql.gz"
RETENTION_DAYS=30

# Create backup
pg_dump -U postgres $DB_NAME | gzip > "$BACKUP_FILE"

# Remove old backups
find "$BACKUP_DIR" -name "shabou-*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Log
echo "$(date): Backup completed - $BACKUP_FILE" >> /var/log/shabou-backup.log
BACKUP_SCRIPT

  chmod +x /usr/local/bin/backup-shabou-db.sh

  # Add to crontab (daily at 2 AM)
  CRON_JOB="0 2 * * * /usr/local/bin/backup-shabou-db.sh"

  if ! crontab -l | grep -q "backup-shabou-db.sh"; then
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo -e "${GREEN}✓ Backup cron job created (daily at 2 AM)${NC}"
  else
    echo -e "${GREEN}✓ Backup cron job already exists${NC}"
  fi
}

# Display connection info
show_connection_info() {
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}Database Connection Information${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo "  Database: $DB_NAME"
  echo "  User: $DB_USER"
  echo "  Password: $DB_PASSWORD"
  echo "  Host: $DB_HOST"
  echo "  Port: $DB_PORT"
  echo ""
  echo "Connection String:"
  echo "  postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
  echo ""
  echo -e "${YELLOW}⚠ Save this information securely!${NC}"
  echo ""

  # Save to .env file
  cat > /root/.shabou-db.env <<EOF
# Shabou Auto Pièces - Database Configuration
# Generated: $(date)

DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=$DB_NAME
POSTGRES_HOST=$DB_HOST
POSTGRES_PORT=$DB_PORT
EOF

  chmod 600 /root/.shabou-db.env
  echo -e "${GREEN}✓ Configuration saved to /root/.shabou-db.env${NC}"
}

# Main execution
main() {
  install_postgresql
  configure_postgresql
  create_database
  setup_backups
  show_connection_info

  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}Database Setup Complete!${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Copy the DATABASE_URL to your backend .env file"
  echo "2. Run database migrations: cd backend/api && npm run db:migrate:deploy"
  echo "3. Test connection: psql -U $DB_USER -d $DB_NAME -h $DB_HOST"
  echo "4. Monitor with: systemctl status postgresql"
  echo ""
}

# Run main function
main
