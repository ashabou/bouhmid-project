# Deployment Guide

Complete guide for deploying Shabou Auto Pièces to staging and production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Server Setup](#server-setup)
- [Staging Environment](#staging-environment)
- [Production Environment](#production-environment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Manual Deployment](#manual-deployment)
- [Rollback Procedure](#rollback-procedure)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Local Machine

- SSH client
- Git
- Docker (optional, for local testing)
- Access to GitHub repository

### VPS Server Requirements

**Minimum Specs:**
- **Staging**: 2 CPU cores, 4GB RAM, 50GB SSD
- **Production**: 4 CPU cores, 8GB RAM, 100GB SSD

**Operating System:**
- Ubuntu 22.04 LTS (recommended)
- Or any Linux distribution with Docker support

**Software:**
- Docker 24.0+
- Docker Compose V2
- Git
- Caddy (for reverse proxy and auto-HTTPS)

---

## Server Setup

### 1. Initial Server Configuration

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl git vim htop ufw fail2ban

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable

# Create deployment user
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG sudo deploy
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

### 2. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add deploy user to docker group
sudo usermod -aG docker deploy

# Install Docker Compose V2
sudo apt install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### 3. Install Caddy (Reverse Proxy)

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Verify installation
caddy version
```

### 4. Setup Application Directory

```bash
# Switch to deploy user
su - deploy

# Create application directory
sudo mkdir -p /opt/shabou-autopieces
sudo chown deploy:deploy /opt/shabou-autopieces
cd /opt/shabou-autopieces

# Clone repository
git clone https://github.com/YOUR_USERNAME/bouhmid-project.git .
cd backend

# Create environment file
cp .env.example .env
```

### 5. Configure Environment Variables

Edit `/opt/shabou-autopieces/backend/.env`:

```bash
vim .env
```

Set all required variables (see `.env.example` for details):
- Database passwords
- JWT secrets
- API keys
- Domain names

### 6. Setup Backup Directory

```bash
# Create backup directory
sudo mkdir -p /backups
sudo chown deploy:deploy /backups

# Setup automated backups (cron)
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /opt/shabou-autopieces/backend && docker-compose exec -T postgres pg_dump -U postgres shabou_autopieces | gzip > /backups/daily-$(date +\%Y\%m\%d).sql.gz

# Add weekly cleanup (keep last 30 days)
0 3 * * 0 find /backups -name "*.sql.gz" -mtime +30 -delete
```

---

## Staging Environment

### Setup Staging Server

**Domain**: `staging-api.shabouautopieces.tn`

**Server**: Use a separate VPS or subdomain

**Configuration**:

1. **Caddy Configuration** (`/etc/caddy/Caddyfile`):

```caddy
staging-api.shabouautopieces.tn {
    reverse_proxy localhost:3000
}

staging-api.shabouautopieces.tn:8001 {
    reverse_proxy localhost:8001
}

staging-api.shabouautopieces.tn:8002 {
    reverse_proxy localhost:8002
}
```

2. **Reload Caddy**:

```bash
sudo systemctl reload caddy
```

3. **Deploy Application**:

```bash
cd /opt/shabou-autopieces/backend
docker-compose up -d
```

4. **Run Migrations**:

```bash
docker-compose exec api npm run db:migrate:deploy
docker-compose exec api npm run db:seed
```

5. **Verify Deployment**:

```bash
# Run health check
./scripts/health-check.sh staging

# Check logs
docker-compose logs -f api
```

---

## Production Environment

### Setup Production Server

**Domain**: `api.shabouautopieces.tn`

**Configuration**:

1. **Caddy Configuration** (`/etc/caddy/Caddyfile`):

```caddy
api.shabouautopieces.tn {
    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Rate limiting
    rate_limit {
        zone api {
            key {remote_host}
            events 100
            window 1m
        }
    }

    # Reverse proxy to API
    reverse_proxy localhost:3000 {
        # Health check
        health_uri /api/v1/health
        health_interval 30s
        health_timeout 10s

        # Load balancing (if scaling to multiple instances)
        lb_policy least_conn
    }

    # Access logging
    log {
        output file /var/log/caddy/api.log
        format json
    }
}

# Internal services (not exposed publicly)
# Access via SSH tunnel if needed
```

2. **Production Docker Compose**:

Use `docker-compose.yml` without the override:

```bash
cd /opt/shabou-autopieces/backend
docker-compose -f docker-compose.yml up -d
```

3. **Enable Automatic Restarts**:

Create systemd service (`/etc/systemd/system/shabou-autopieces.service`):

```ini
[Unit]
Description=Shabou Auto Pièces Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/shabou-autopieces/backend
ExecStart=/usr/bin/docker compose -f docker-compose.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.yml down
User=deploy

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable shabou-autopieces
sudo systemctl start shabou-autopieces
```

---

## CI/CD Pipeline

### GitHub Actions Setup

The CI/CD pipeline is configured in `.github/workflows/`:

- **`ci.yml`**: Runs tests on PRs and pushes
- **`cd.yml`**: Builds images and deploys to staging/production

### Required Secrets

Configure in GitHub repository settings > Secrets and variables > Actions:

**Staging Secrets:**
- `STAGING_HOST`: Staging server IP/hostname
- `STAGING_USER`: SSH username (usually `deploy`)
- `STAGING_SSH_PRIVATE_KEY`: SSH private key for staging server

**Production Secrets:**
- `PRODUCTION_HOST`: Production server IP/hostname
- `PRODUCTION_USER`: SSH username (usually `deploy`)
- `PRODUCTION_SSH_PRIVATE_KEY`: SSH private key for production server

**Optional:**
- `SLACK_WEBHOOK`: Slack webhook URL for deployment notifications
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

### Deployment Workflow

**Automatic Deployments:**

1. **To Staging**: Automatically on push to `main` branch
2. **To Production**: Automatically on tag push (`v*.*.*`)

```bash
# Deploy to staging (via push to main)
git push origin main

# Deploy to production (via tag)
git tag v1.0.0
git push origin v1.0.0
```

**Manual Deployments:**

Trigger via GitHub Actions UI:
1. Go to Actions tab
2. Select "CD - Build & Deploy" workflow
3. Click "Run workflow"
4. Select environment (staging or production)

---

## Manual Deployment

Use the deployment script for manual deployments:

### Deploy to Staging

```bash
# Set environment variables
export STAGING_HOST="staging.shabouautopieces.tn"
export STAGING_USER="deploy"
export STAGING_SSH_KEY="~/.ssh/id_rsa"

# Run deployment
./scripts/deploy.sh staging
```

### Deploy to Production

```bash
# Set environment variables
export PRODUCTION_HOST="api.shabouautopieces.tn"
export PRODUCTION_USER="deploy"
export PRODUCTION_SSH_KEY="~/.ssh/id_rsa"

# Run deployment
./scripts/deploy.sh production
```

The script will:
1. Test SSH connection
2. Create database backup
3. Pull latest code
4. Pull latest Docker images
5. Run database migrations
6. Restart services
7. Run health checks
8. Offer rollback if health checks fail

---

## Rollback Procedure

### Automatic Rollback

If health checks fail during deployment, the script will offer to rollback automatically.

### Manual Rollback

Use the rollback script:

```bash
# Rollback to most recent backup
./scripts/rollback.sh production

# Rollback to specific backup
./scripts/rollback.sh production /backups/pre-deploy-20231115-143022.sql.gz

# List available backups
ssh deploy@api.shabouautopieces.tn "ls -lht /backups/pre-deploy-*.sql.gz | head -10"
```

The rollback process:
1. Creates a backup of current state (before rollback)
2. Stops services
3. Restores database from backup
4. Restarts services
5. Verifies health

---

## Monitoring

### Health Checks

Run health checks anytime:

```bash
# Check local environment
./scripts/health-check.sh local

# Check staging
./scripts/health-check.sh staging

# Check production
./scripts/health-check.sh production
```

### Log Monitoring

```bash
# API logs
docker-compose logs -f api

# Prospector logs
docker-compose logs -f prospector

# Orion logs
docker-compose logs -f orion

# All services
docker-compose logs -f
```

### Resource Monitoring

```bash
# Container stats
docker stats

# Disk usage
df -h

# Database size
docker-compose exec postgres psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('shabou_autopieces'));"
```

---

## Troubleshooting

### Deployment Fails

1. **Check logs**:
   ```bash
   docker-compose logs api
   ```

2. **Verify environment variables**:
   ```bash
   docker-compose config
   ```

3. **Test database connection**:
   ```bash
   docker-compose exec postgres pg_isready -U postgres
   ```

### Services Not Starting

1. **Check Docker daemon**:
   ```bash
   sudo systemctl status docker
   ```

2. **Check port conflicts**:
   ```bash
   sudo netstat -tulpn | grep -E ':(3000|8001|8002|5432|6379)'
   ```

3. **Rebuild containers**:
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```

### SSL Certificate Issues

1. **Check Caddy logs**:
   ```bash
   sudo journalctl -u caddy -f
   ```

2. **Verify DNS**:
   ```bash
   dig api.shabouautopieces.tn
   ```

3. **Test HTTPS**:
   ```bash
   curl -I https://api.shabouautopieces.tn
   ```

### Database Connection Issues

1. **Check PostgreSQL**:
   ```bash
   docker-compose exec postgres psql -U postgres -c "SELECT version();"
   ```

2. **Check connection string**:
   ```bash
   echo $DATABASE_URL
   ```

3. **Reset connections**:
   ```bash
   docker-compose restart postgres
   ```

### Out of Disk Space

1. **Check disk usage**:
   ```bash
   df -h
   du -sh /var/lib/docker/*
   ```

2. **Clean Docker**:
   ```bash
   docker system prune -a --volumes
   ```

3. **Clean old backups**:
   ```bash
   find /backups -name "*.sql.gz" -mtime +30 -delete
   ```

---

## Performance Tuning

### Database Optimization

Edit `/opt/shabou-autopieces/backend/docker-compose.yml`:

```yaml
postgres:
  environment:
    # Increase shared buffers (25% of RAM)
    POSTGRES_SHARED_BUFFERS: "2GB"
    # Increase work memory
    POSTGRES_WORK_MEM: "64MB"
    # Increase max connections
    POSTGRES_MAX_CONNECTIONS: "200"
```

### API Scaling

Scale API instances for high traffic:

```bash
docker-compose up -d --scale api=3
```

Update Caddy to load balance:

```caddy
api.shabouautopieces.tn {
    reverse_proxy localhost:3000 localhost:3001 localhost:3002 {
        lb_policy least_conn
    }
}
```

### Redis Optimization

```yaml
redis:
  command: redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru
```

---

## Security Checklist

- [ ] Strong passwords for database and Redis
- [ ] JWT secrets are random and secure (32+ characters)
- [ ] Firewall configured (UFW or iptables)
- [ ] Fail2ban installed and configured
- [ ] SSH key-based authentication only (disable password auth)
- [ ] Regular security updates (`unattended-upgrades`)
- [ ] HTTPS enabled with valid certificates
- [ ] Security headers configured in Caddy
- [ ] Regular backups (daily + tested restores)
- [ ] Monitoring and alerting setup
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Secrets not committed to git
- [ ] Docker containers run as non-root users

---

**Documentation Version:** 1.0
**Last Updated:** 2025-11-15
**Maintained by:** Shabou Auto Pièces Engineering Team
