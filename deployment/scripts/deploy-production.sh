#!/bin/bash
# ========================================
# Shabou Auto Pièces - Production Deployment
# Complete deployment automation script
# ========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_DIR="/var/www/shabou-autopieces"
REPO_URL="https://github.com/ashabou/bouhmid-project.git"
BRANCH="${BRANCH:-main}"
ENVIRONMENT="production"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Shabou Auto Pièces - Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Branch: $BRANCH"
echo "Time: $(date)"
echo ""

# Pre-flight checks
preflight_checks() {
  echo -e "${YELLOW}Running pre-flight checks...${NC}"

  # Check if running as root
  if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    exit 1
  fi

  # Check required commands
  local REQUIRED_CMDS=("git" "node" "npm" "docker" "docker-compose" "nginx" "psql")
  for cmd in "${REQUIRED_CMDS[@]}"; do
    if ! command -v $cmd &> /dev/null; then
      echo -e "${RED}Error: $cmd is not installed${NC}"
      exit 1
    fi
  done

  # Check if .env file exists
  if [ ! -f "$APP_DIR/backend/.env" ]; then
    echo -e "${RED}Error: Backend .env file not found${NC}"
    exit 1
  fi

  echo -e "${GREEN}✓ Pre-flight checks passed${NC}"
}

# Create backup before deployment
create_backup() {
  echo ""
  echo -e "${YELLOW}Creating backup before deployment...${NC}"

  if [ -f /usr/local/bin/backup-shabou.sh ]; then
    /usr/local/bin/backup-shabou.sh
    echo -e "${GREEN}✓ Backup created${NC}"
  else
    echo -e "${YELLOW}⚠ Backup script not found, skipping${NC}"
  fi
}

# Pull latest code
pull_code() {
  echo ""
  echo -e "${YELLOW}Pulling latest code...${NC}"

  cd "$APP_DIR"

  # Stash any local changes
  git stash save "Auto-stash before deployment $(date)"

  # Fetch and pull
  git fetch origin
  git checkout $BRANCH
  git pull origin $BRANCH

  # Show current commit
  local COMMIT=$(git rev-parse --short HEAD)
  local COMMIT_MSG=$(git log -1 --pretty=%B)

  echo -e "${GREEN}✓ Code updated to commit: $COMMIT${NC}"
  echo -e "${GREEN}  Message: $COMMIT_MSG${NC}"
}

# Install dependencies
install_dependencies() {
  echo ""
  echo -e "${YELLOW}Installing dependencies...${NC}"

  # Backend API dependencies
  cd "$APP_DIR/backend/api"
  npm ci --production
  echo -e "${GREEN}✓ API dependencies installed${NC}"

  # Python dependencies (Prospector)
  cd "$APP_DIR/backend/agents/prospector"
  pip3 install -r requirements.txt --quiet
  echo -e "${GREEN}✓ Prospector dependencies installed${NC}"

  # Python dependencies (Orion)
  cd "$APP_DIR/backend/agents/orion"
  pip3 install -r requirements.txt --quiet
  echo -e "${GREEN}✓ Orion dependencies installed${NC}"
}

# Build applications
build_applications() {
  echo ""
  echo -e "${YELLOW}Building applications...${NC}"

  # Build API
  cd "$APP_DIR/backend/api"
  npm run build
  echo -e "${GREEN}✓ API built${NC}"

  # Build frontend (if exists)
  if [ -d "$APP_DIR/frontend" ]; then
    cd "$APP_DIR/frontend"
    npm ci
    npm run build
    echo -e "${GREEN}✓ Frontend built${NC}"
  fi
}

# Run database migrations
run_migrations() {
  echo ""
  echo -e "${YELLOW}Running database migrations...${NC}"

  cd "$APP_DIR/backend/api"

  # Generate Prisma client
  npm run db:generate

  # Run migrations
  npm run db:migrate:deploy

  echo -e "${GREEN}✓ Database migrations completed${NC}"
}

# Restart services
restart_services() {
  echo ""
  echo -e "${YELLOW}Restarting services...${NC}"

  # Restart Docker services
  cd "$APP_DIR/backend"
  docker-compose down
  docker-compose up -d --build

  # Wait for services to be healthy
  echo -e "${YELLOW}Waiting for services to start...${NC}"
  sleep 10

  # Check service health
  local SERVICES=("api" "prospector" "orion" "postgres" "redis")
  for service in "${SERVICES[@]}"; do
    if docker-compose ps | grep -q "$service.*Up"; then
      echo -e "${GREEN}✓ $service is running${NC}"
    else
      echo -e "${RED}✗ $service failed to start${NC}"
      docker-compose logs $service
    fi
  done

  # Reload Nginx
  nginx -t && systemctl reload nginx
  echo -e "${GREEN}✓ Nginx reloaded${NC}"
}

# Health checks
health_checks() {
  echo ""
  echo -e "${YELLOW}Running health checks...${NC}"

  local MAX_RETRIES=30
  local RETRY_DELAY=2

  # Check API health
  for i in $(seq 1 $MAX_RETRIES); do
    if curl -f http://localhost:3000/health >/dev/null 2>&1; then
      echo -e "${GREEN}✓ API is healthy${NC}"
      break
    fi

    if [ $i -eq $MAX_RETRIES ]; then
      echo -e "${RED}✗ API health check failed${NC}"
      exit 1
    fi

    echo -e "${YELLOW}  Waiting for API... ($i/$MAX_RETRIES)${NC}"
    sleep $RETRY_DELAY
  done

  # Check Prospector health
  if curl -f http://localhost:8001/health >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Prospector is healthy${NC}"
  else
    echo -e "${YELLOW}⚠ Prospector health check failed${NC}"
  fi

  # Check Orion health
  if curl -f http://localhost:8002/health >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Orion is healthy${NC}"
  else
    echo -e "${YELLOW}⚠ Orion health check failed${NC}"
  fi

  # Check database connection
  if PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h localhost -d $DB_NAME -c "SELECT 1" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Database is healthy${NC}"
  else
    echo -e "${RED}✗ Database connection failed${NC}"
    exit 1
  fi

  # Check Redis
  if redis-cli ping >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is healthy${NC}"
  else
    echo -e "${YELLOW}⚠ Redis check failed${NC}"
  fi
}

# Post-deployment tasks
post_deployment() {
  echo ""
  echo -e "${YELLOW}Running post-deployment tasks...${NC}"

  # Clear caches
  cd "$APP_DIR/backend/api"
  # Add cache clearing logic here if needed

  # Warm up caches (optional)
  # curl http://localhost:3000/api/v1/products?limit=1 >/dev/null 2>&1

  echo -e "${GREEN}✓ Post-deployment tasks completed${NC}"
}

# Send deployment notification
send_notification() {
  local STATUS=$1
  local COMMIT=$(git -C "$APP_DIR" rev-parse --short HEAD)
  local COMMIT_MSG=$(git -C "$APP_DIR" log -1 --pretty=%B)

  # Skip if no webhook configured
  if [ -z "$SLACK_WEBHOOK_URL" ]; then
    return
  fi

  local COLOR="good"
  local EMOJI="🚀"
  if [ "$STATUS" != "success" ]; then
    COLOR="danger"
    EMOJI="❌"
  fi

  curl -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{
      \"attachments\": [{
        \"color\": \"$COLOR\",
        \"title\": \"$EMOJI Deployment to Production\",
        \"text\": \"Status: *$STATUS*\",
        \"fields\": [
          {\"title\": \"Environment\", \"value\": \"$ENVIRONMENT\", \"short\": true},
          {\"title\": \"Branch\", \"value\": \"$BRANCH\", \"short\": true},
          {\"title\": \"Commit\", \"value\": \"$COMMIT\", \"short\": true},
          {\"title\": \"Time\", \"value\": \"$(date)\", \"short\": true},
          {\"title\": \"Message\", \"value\": \"$COMMIT_MSG\", \"short\": false}
        ]
      }]
    }" 2>/dev/null || true
}

# Rollback function
rollback() {
  echo ""
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}Deployment Failed - Rolling Back${NC}"
  echo -e "${RED}========================================${NC}"
  echo ""

  # Restore from backup
  echo -e "${YELLOW}Restoring from backup...${NC}"

  # Find latest backup
  local LATEST_BACKUP=$(find /var/backups/shabou-autopieces/database -name "shabou-db-*.sql.gz" | sort -r | head -1)

  if [ -n "$LATEST_BACKUP" ]; then
    echo -e "${YELLOW}Restoring database from: $LATEST_BACKUP${NC}"
    gunzip -c "$LATEST_BACKUP" | PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h localhost $DB_NAME
    echo -e "${GREEN}✓ Database restored${NC}"
  fi

  # Restart services with old code
  cd "$APP_DIR/backend"
  docker-compose restart

  send_notification "failed"

  exit 1
}

# Main execution
main() {
  local START_TIME=$(date +%s)

  # Trap errors for rollback
  trap 'rollback' ERR

  preflight_checks
  create_backup
  pull_code
  install_dependencies
  build_applications
  run_migrations
  restart_services
  health_checks
  post_deployment

  local END_TIME=$(date +%s)
  local DURATION=$((END_TIME - START_TIME))

  echo ""
  echo -e "${BLUE}========================================${NC}"
  echo -e "${GREEN}✓ Deployment Successful!${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo ""
  echo "Duration: ${DURATION}s"
  echo "Environment: $ENVIRONMENT"
  echo "Branch: $BRANCH"
  echo "Commit: $(git -C "$APP_DIR" rev-parse --short HEAD)"
  echo ""
  echo "Services:"
  echo "  API: https://api.shabouautopieces.tn"
  echo "  Frontend: https://shabouautopieces.tn"
  echo "  Grafana: https://grafana.shabouautopieces.tn"
  echo ""

  send_notification "success"

  # Log to syslog
  logger "Shabou Auto Pièces deployed successfully (Duration: ${DURATION}s)"
}

# Run main function
main
