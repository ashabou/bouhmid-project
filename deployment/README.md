# Shabou Auto Pièces - Production Deployment

Complete production deployment guide for the Shabou Auto Pièces platform.

## 📁 Directory Structure

```
deployment/
├── README.md                          # This file
├── PRODUCTION-CHECKLIST.md            # Complete deployment checklist
├── ssl/
│   └── setup-ssl.sh                   # SSL certificate setup (Let's Encrypt)
├── nginx/
│   └── shabou-autopieces.conf         # Nginx configuration with SSL
├── database/
│   └── setup-production-db.sh         # PostgreSQL setup and configuration
└── scripts/
    ├── backup.sh                      # Automated backup script
    └── deploy-production.sh           # Main deployment script
```

## 🚀 Quick Start

### Prerequisites

1. **Server Requirements**:
   - Ubuntu 22.04 LTS or CentOS 8+
   - Minimum 2GB RAM, 2 CPUs, 40GB SSD
   - Root/sudo access
   - Domain configured with DNS

2. **Required Software** (installed by scripts):
   - Node.js 20.x
   - Python 3.11+
   - PostgreSQL 15
   - Redis 7
   - Nginx
   - Docker & Docker Compose
   - Certbot

### Step-by-Step Deployment

#### 1. Initial Server Setup

```bash
# Connect to server
ssh root@your-server-ip

# Clone repository
cd /var/www
git clone https://github.com/ashabou/bouhmid-project.git shabou-autopieces
cd shabou-autopieces/deployment
```

#### 2. SSL Certificate Setup

```bash
# Setup Let's Encrypt SSL
cd ssl
./setup-ssl.sh
```

**Environment Variables**:
- `DOMAIN`: Your domain (default: shabouautopieces.tn)
- `SSL_EMAIL`: Email for Let's Encrypt (default: admin@shabouautopieces.tn)
- `STAGING`: Use staging server for testing (default: false)

**What it does**:
- Installs certbot
- Obtains SSL certificates for all subdomains
- Configures auto-renewal (twice daily)
- Tests renewal process

#### 3. Database Setup

```bash
# Setup PostgreSQL
cd ../database
./setup-production-db.sh
```

**Environment Variables**:
- `DB_NAME`: Database name (default: shabou_autopieces)
- `DB_USER`: Database user (default: shabou_user)
- `DB_PASSWORD`: Auto-generated if not provided
- `POSTGRES_VERSION`: PostgreSQL version (default: 15)

**What it does**:
- Installs PostgreSQL 15
- Configures performance tuning
- Creates database and user
- Installs required extensions (uuid-ossp, pg_trgm)
- Sets up automated backups (daily at 2 AM)
- Saves credentials to `/root/.shabou-db.env`

#### 4. Nginx Configuration

```bash
# Copy and enable Nginx config
cd ../nginx
cp shabou-autopieces.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/shabou-autopieces.conf /etc/nginx/sites-enabled/

# Test and reload
nginx -t
systemctl reload nginx
```

**What it configures**:
- SSL/TLS with HTTP/2
- HTTP to HTTPS redirect
- Reverse proxy for API, Prospector, Orion
- Rate limiting (100 req/min API, 5 req/min auth)
- Static file caching
- Gzip compression
- Security headers (HSTS, X-Frame-Options, etc.)

#### 5. Application Deployment

```bash
# Configure environment
cd /var/www/shabou-autopieces/backend
cp .env.example .env
nano .env  # Fill in production values

# Run deployment
cd ../../deployment/scripts
./deploy-production.sh
```

**Environment Variables Required**:
```bash
NODE_ENV=production
DATABASE_URL=postgresql://shabou_user:PASSWORD@localhost:5432/shabou_autopieces
REDIS_PASSWORD=YOUR_REDIS_PASSWORD
JWT_SECRET=YOUR_JWT_SECRET
JWT_REFRESH_SECRET=YOUR_JWT_REFRESH_SECRET
CORS_ORIGIN=https://shabouautopieces.tn
GOOGLE_MAPS_API_KEY=YOUR_API_KEY
SMTP_HOST=smtp.gmail.com
SMTP_USER=alerts@shabouautopieces.tn
SMTP_PASSWORD=YOUR_SMTP_PASSWORD
```

**What it does**:
- Pre-flight checks (dependencies, .env file)
- Creates backup before deployment
- Pulls latest code from Git
- Installs dependencies (npm, pip)
- Builds applications (API, frontend)
- Runs database migrations
- Restarts services (Docker Compose)
- Runs health checks
- Sends Slack notification (if configured)
- Automatic rollback on failure

#### 6. Backup Configuration

```bash
# Setup automated backups
cp scripts/backup.sh /usr/local/bin/backup-shabou.sh
chmod +x /usr/local/bin/backup-shabou.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-shabou.sh
```

**What it backs up**:
- PostgreSQL database (compressed with gzip)
- Application files (uploads, logs)
- Configuration files (Nginx, .env, SSL certs)
- Metadata manifest (JSON)

**Storage**:
- Local: `/var/backups/shabou-autopieces/`
- S3 (optional): Configure with `S3_BUCKET` and `S3_ENABLED=true`

**Retention**: 30 days (configurable with `RETENTION_DAYS`)

---

## 📋 Deployment Checklist

See [PRODUCTION-CHECKLIST.md](./PRODUCTION-CHECKLIST.md) for complete deployment checklist.

### Quick Verification

```bash
# Check services status
docker-compose ps

# Check API health
curl https://api.shabouautopieces.tn/health

# Check SSL certificate
certbot certificates

# Check database connection
psql -U shabou_user -d shabou_autopieces -c "SELECT version();"

# Check backups
ls -lh /var/backups/shabou-autopieces/

# Check logs
docker-compose logs api
docker-compose logs prospector
docker-compose logs orion
```

---

## 🔧 Maintenance

### Daily Tasks

```bash
# Check application health
curl https://api.shabouautopieces.tn/health

# Check service status
docker-compose ps

# Review error logs
docker-compose logs --tail=100 api | grep ERROR
```

### Weekly Tasks

```bash
# Check disk space
df -h

# Review Grafana dashboards
# Visit: https://grafana.shabouautopieces.tn

# Update dependencies (test in staging first)
cd /var/www/shabou-autopieces
git pull
./deployment/scripts/deploy-production.sh
```

### Monthly Tasks

```bash
# Apply security patches
apt update && apt upgrade -y

# Database optimization
psql -U shabou_user -d shabou_autopieces -c "VACUUM ANALYZE;"

# Test backup restoration
# See "Disaster Recovery" section below
```

---

## 🚨 Troubleshooting

### Service Won't Start

```bash
# Check Docker logs
docker-compose logs <service-name>

# Check system resources
htop
df -h

# Restart specific service
docker-compose restart <service-name>

# Restart all services
docker-compose restart
```

### SSL Certificate Issues

```bash
# Check certificate status
certbot certificates

# Renew certificate manually
certbot renew --force-renewal

# Test renewal
certbot renew --dry-run
```

### Database Connection Errors

```bash
# Check PostgreSQL status
systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Check logs
tail -f /var/log/postgresql/postgresql-15-main.log
```

### High Resource Usage

```bash
# Check Docker stats
docker stats

# Check process list
htop

# Review Grafana Infrastructure dashboard
# Visit: https://grafana.shabouautopieces.tn/d/shabou-infrastructure

# Scale services if needed
docker-compose up -d --scale api=2
```

---

## 💾 Backup & Recovery

### Manual Backup

```bash
# Run backup script
/usr/local/bin/backup-shabou.sh

# Or with custom settings
RETENTION_DAYS=60 S3_ENABLED=true /usr/local/bin/backup-shabou.sh
```

### Restore from Backup

```bash
# Find latest backup
ls -lht /var/backups/shabou-autopieces/database/

# Restore database
LATEST_BACKUP="/var/backups/shabou-autopieces/database/2024/11/15/shabou-db-20241115-020000.sql.gz"
gunzip -c $LATEST_BACKUP | psql -U shabou_user -d shabou_autopieces

# Restore files
LATEST_FILES="/var/backups/shabou-autopieces/files/2024/11/15/shabou-files-20241115-020000.tar.gz"
tar -xzf $LATEST_FILES -C /var/www/shabou-autopieces/

# Restart services
docker-compose restart
```

### S3 Backup Configuration

```bash
# Install AWS CLI
apt install -y awscli

# Configure AWS credentials
aws configure

# Enable S3 in backup script
export S3_BUCKET=your-bucket-name
export S3_ENABLED=true
/usr/local/bin/backup-shabou.sh
```

---

## 🔐 Security

### Firewall Configuration

```bash
# UFW (Ubuntu/Debian)
ufw allow 22      # SSH
ufw allow 80      # HTTP
ufw allow 443     # HTTPS
ufw enable

# Fail2ban (brute force protection)
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

### SSH Hardening

```bash
# Edit SSH config
nano /etc/ssh/sshd_config

# Recommended settings:
# PermitRootLogin no
# PasswordAuthentication no
# PubkeyAuthentication yes
# Port 2222  # Change SSH port (optional)

# Restart SSH
systemctl restart sshd
```

### Database Security

```bash
# Change default PostgreSQL password
sudo -u postgres psql
ALTER USER postgres WITH PASSWORD 'SECURE_PASSWORD';

# Restrict network access
nano /etc/postgresql/15/main/pg_hba.conf
# Only allow local connections
```

---

## 📊 Monitoring

### Grafana Dashboards

Visit: https://grafana.shabouautopieces.tn

**Default Login**:
- Username: `admin`
- Password: Set in `GRAFANA_ADMIN_PASSWORD` env var

**Available Dashboards**:
1. **API Performance**: Latency, error rates, cache metrics
2. **Business Metrics**: Product views, leads, forecasts
3. **Infrastructure**: CPU, memory, disk, network
4. **Logs**: Centralized log viewer

### Prometheus Metrics

Visit: http://localhost:9090 (internal only)

**Example Queries**:
```promql
# API response time (P95)
histogram_quantile(0.95, rate(shabou_api_http_request_duration_seconds_bucket[5m]))

# Error rate
rate(shabou_api_http_errors_total[5m])

# Cache hit ratio
shabou_api_cache_hit_ratio
```

### Alert Configuration

Edit: `/var/www/shabou-autopieces/backend/monitoring/alertmanager/alertmanager.yml`

Add your SMTP/Slack credentials for notifications.

---

## 🔄 Updates & Deployments

### Deploy New Version

```bash
cd /var/www/shabou-autopieces/deployment/scripts
./deploy-production.sh
```

### Rollback to Previous Version

```bash
# Automatic rollback on deployment failure
# Or manual rollback:

cd /var/www/shabou-autopieces
git checkout <previous-commit>

# Restore database from backup
# See "Restore from Backup" section

# Restart services
docker-compose restart
```

### Zero-Downtime Deployment

```bash
# Use blue-green deployment
# 1. Deploy to staging first
# 2. Test thoroughly
# 3. Switch DNS or reverse proxy to new version
# 4. Keep old version running for quick rollback
```

---

## 📞 Support

For production issues:

1. **Check Grafana dashboards**: https://grafana.shabouautopieces.tn
2. **Review logs**: `docker-compose logs`
3. **Check health endpoints**: `curl https://api.shabouautopieces.tn/health`
4. **Contact support**: admin@shabouautopieces.tn

---

## 📚 Additional Resources

- [Production Checklist](./PRODUCTION-CHECKLIST.md) - Complete deployment checklist
- [Backend Documentation](../backend/README.md) - API and service documentation
- [Monitoring Guide](../backend/monitoring/MONITORING.md) - Observability setup
- [Frontend Integration](../backend/FRONTEND-INTEGRATION.md) - Frontend API integration
- [API Documentation](https://api.shabouautopieces.tn/docs) - Swagger UI

---

**Last Updated**: November 2024
**Version**: 1.0.0
**Maintained by**: Shabou Auto Pièces DevOps Team
