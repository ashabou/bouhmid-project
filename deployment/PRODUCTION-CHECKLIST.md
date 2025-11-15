# Production Deployment Checklist

Complete checklist for deploying Shabou Auto Pièces to production.

## 📋 Pre-Deployment Checklist

### Server Setup

- [ ] **VPS/Server Provisioned**
  - [ ] Minimum 2GB RAM, 2 CPUs, 40GB SSD
  - [ ] Ubuntu 22.04 LTS or CentOS 8+
  - [ ] Root/sudo access configured
  - [ ] SSH key authentication enabled
  - [ ] Firewall configured (UFW/firewalld)

- [ ] **Domain Configuration**
  - [ ] Domain purchased: `shabouautopieces.tn`
  - [ ] DNS A records configured:
    - [ ] `shabouautopieces.tn` → Server IP
    - [ ] `www.shabouautopieces.tn` → Server IP
    - [ ] `api.shabouautopieces.tn` → Server IP
    - [ ] `grafana.shabouautopieces.tn` → Server IP
    - [ ] `staging.shabouautopieces.tn` → Server IP
  - [ ] DNS propagation verified (24-48 hours)

- [ ] **Required Software Installed**
  - [ ] Node.js 20.x
  - [ ] Python 3.11+
  - [ ] PostgreSQL 15
  - [ ] Redis 7
  - [ ] Nginx
  - [ ] Docker & Docker Compose
  - [ ] Git
  - [ ] Certbot (Let's Encrypt)

### Security

- [ ] **Firewall Configuration**
  - [ ] Allow SSH (22)
  - [ ] Allow HTTP (80)
  - [ ] Allow HTTPS (443)
  - [ ] Block all other ports
  - [ ] Configure fail2ban

- [ ] **SSH Hardening**
  - [ ] Disable password authentication
  - [ ] Disable root login
  - [ ] Change SSH port (optional but recommended)
  - [ ] Setup SSH key authentication

- [ ] **Environment Variables**
  - [ ] Generate secure JWT secrets (min 32 characters)
  - [ ] Generate secure database password
  - [ ] Generate secure Redis password
  - [ ] Setup SMTP credentials
  - [ ] Configure API keys (Google Maps, etc.)

### Database

- [ ] **PostgreSQL Setup**
  - [ ] PostgreSQL installed and running
  - [ ] Database created: `shabou_autopieces`
  - [ ] Database user created with strong password
  - [ ] Database backups configured
  - [ ] Connection tested

- [ ] **Redis Setup**
  - [ ] Redis installed and running
  - [ ] Password authentication enabled
  - [ ] Persistence configured (AOF + RDB)
  - [ ] Maxmemory policy set

---

## 🚀 Deployment Steps

### Step 1: Server Preparation

```bash
# Update system
apt update && apt upgrade -y

# Install required software
./deployment/scripts/install-dependencies.sh

# Configure firewall
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

### Step 2: SSL/TLS Setup

```bash
# Run SSL setup script
cd /root/bouhmid-project/deployment/ssl
chmod +x setup-ssl.sh
./setup-ssl.sh

# Verify certificate
certbot certificates
```

**Checklist:**
- [ ] SSL certificates obtained
- [ ] Auto-renewal configured
- [ ] HTTPS working on all domains

### Step 3: Database Setup

```bash
# Run database setup script
cd /root/bouhmid-project/deployment/database
chmod +x setup-production-db.sh
./setup-production-db.sh

# Save database credentials securely
cat /root/.shabou-db.env
```

**Checklist:**
- [ ] Database created
- [ ] User created with secure password
- [ ] Extensions installed (uuid-ossp, pg_trgm)
- [ ] Backups configured
- [ ] Connection tested

### Step 4: Application Deployment

```bash
# Clone repository
cd /var/www
git clone https://github.com/ashabou/bouhmid-project.git shabou-autopieces
cd shabou-autopieces

# Configure environment
cp backend/.env.example backend/.env
nano backend/.env  # Fill in production values

# Run deployment script
cd deployment/scripts
chmod +x deploy-production.sh
./deploy-production.sh
```

**Checklist:**
- [ ] Code deployed
- [ ] Dependencies installed
- [ ] Database migrations run
- [ ] Services started
- [ ] Health checks passing

### Step 5: Nginx Configuration

```bash
# Copy Nginx config
cp deployment/nginx/shabou-autopieces.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/shabou-autopieces.conf /etc/nginx/sites-enabled/

# Test and reload
nginx -t
systemctl reload nginx
```

**Checklist:**
- [ ] Nginx configuration deployed
- [ ] SSL certificates configured
- [ ] Reverse proxy working
- [ ] HTTPS redirection working
- [ ] CORS headers configured

### Step 6: Monitoring Setup

```bash
# Start monitoring stack
cd /var/www/shabou-autopieces/backend
docker-compose up -d prometheus loki promtail grafana alertmanager

# Configure alerting
nano monitoring/alertmanager/alertmanager.yml  # Add SMTP/Slack
```

**Checklist:**
- [ ] Prometheus collecting metrics
- [ ] Loki aggregating logs
- [ ] Grafana dashboards loaded
- [ ] Alertmanager configured
- [ ] Email/Slack notifications working

### Step 7: Backup Configuration

```bash
# Setup automated backups
cp deployment/scripts/backup.sh /usr/local/bin/backup-shabou.sh
chmod +x /usr/local/bin/backup-shabou.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-shabou.sh
```

**Checklist:**
- [ ] Backup script configured
- [ ] Cron job created
- [ ] Test backup run successful
- [ ] Backup retention configured (30 days)
- [ ] S3 upload configured (optional)

---

## ✅ Post-Deployment Verification

### Functional Testing

- [ ] **Frontend**
  - [ ] https://shabouautopieces.tn loads
  - [ ] All pages accessible
  - [ ] Images loading
  - [ ] Forms working
  - [ ] Search working

- [ ] **API**
  - [ ] https://api.shabouautopieces.tn/health returns 200
  - [ ] https://api.shabouautopieces.tn/docs loads
  - [ ] Product endpoints working
  - [ ] Authentication working
  - [ ] Admin endpoints working

- [ ] **Services**
  - [ ] API service running
  - [ ] Prospector service running
  - [ ] Orion service running
  - [ ] Celery workers running
  - [ ] Database accessible
  - [ ] Redis accessible

### Performance Testing

- [ ] **Load Testing**
  - [ ] API response time < 200ms (p95)
  - [ ] Frontend load time < 2s
  - [ ] Database query performance acceptable
  - [ ] Cache hit ratio > 50%

- [ ] **Resource Monitoring**
  - [ ] CPU usage < 60% under normal load
  - [ ] Memory usage < 70%
  - [ ] Disk usage < 70%
  - [ ] Network bandwidth sufficient

### Security Testing

- [ ] **SSL/TLS**
  - [ ] HTTPS working on all domains
  - [ ] HTTP redirects to HTTPS
  - [ ] SSL Labs rating A or higher
  - [ ] HSTS headers present

- [ ] **Security Headers**
  - [ ] X-Frame-Options configured
  - [ ] X-Content-Type-Options configured
  - [ ] X-XSS-Protection configured
  - [ ] Referrer-Policy configured
  - [ ] CSP headers configured

- [ ] **Authentication**
  - [ ] JWT tokens working
  - [ ] Refresh tokens working
  - [ ] Session timeout working
  - [ ] Password reset working

### Monitoring & Alerting

- [ ] **Grafana Dashboards**
  - [ ] https://grafana.shabouautopieces.tn accessible
  - [ ] API Performance dashboard working
  - [ ] Business Metrics dashboard working
  - [ ] Infrastructure dashboard working
  - [ ] Logs dashboard working

- [ ] **Prometheus**
  - [ ] Metrics collecting from all services
  - [ ] Alert rules loaded
  - [ ] Alerts firing correctly (test)

- [ ] **Alertmanager**
  - [ ] Email notifications working
  - [ ] Slack notifications working (if configured)
  - [ ] Alert routing working
  - [ ] Silencing working

### Backup & Recovery

- [ ] **Backup Testing**
  - [ ] Database backup successful
  - [ ] File backup successful
  - [ ] Config backup successful
  - [ ] Backup restoration tested

- [ ] **Disaster Recovery**
  - [ ] Recovery procedure documented
  - [ ] RTO/RPO defined
  - [ ] Backup location accessible
  - [ ] Recovery tested

---

## 📊 Production Configuration

### Environment Variables

Create `/var/www/shabou-autopieces/backend/.env`:

```bash
# Application
NODE_ENV=production
PYTHON_ENV=production

# Database
DATABASE_URL=postgresql://shabou_user:SECURE_PASSWORD@localhost:5432/shabou_autopieces
POSTGRES_USER=shabou_user
POSTGRES_PASSWORD=SECURE_PASSWORD
POSTGRES_DB=shabou_autopieces

# Redis
REDIS_PASSWORD=SECURE_REDIS_PASSWORD

# JWT
JWT_SECRET=SECURE_JWT_SECRET_MIN_32_CHARS
JWT_REFRESH_SECRET=SECURE_JWT_REFRESH_SECRET_MIN_32_CHARS

# CORS
CORS_ORIGIN=https://shabouautopieces.tn,https://www.shabouautopieces.tn

# External APIs
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
GRAFANA_ADMIN_PASSWORD=SECURE_GRAFANA_PASSWORD

# Alerts
SMTP_HOST=smtp.gmail.com
SMTP_USER=alerts@shabouautopieces.tn
SMTP_PASSWORD=YOUR_SMTP_PASSWORD
SLACK_WEBHOOK_URL=YOUR_SLACK_WEBHOOK (optional)

# Backups
S3_BUCKET=shabou-backups (optional)
S3_ENABLED=false
```

### Firewall Rules

```bash
# UFW (Ubuntu/Debian)
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP
ufw allow 443/tcp     # HTTPS
ufw enable

# Firewalld (CentOS/RHEL)
firewall-cmd --permanent --add-service=ssh
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

### Nginx Configuration

Location: `/etc/nginx/sites-available/shabou-autopieces.conf`

Key settings:
- SSL/TLS with Let's Encrypt
- HTTP to HTTPS redirect
- Rate limiting (100 req/min for API, 5 req/min for auth)
- Reverse proxy to backend services
- Static file caching (1 year)
- Gzip compression

---

## 🔧 Maintenance

### Daily Tasks

- [ ] Check error logs
- [ ] Monitor system resources
- [ ] Verify backups completed
- [ ] Check application health

### Weekly Tasks

- [ ] Review Grafana dashboards
- [ ] Check disk space
- [ ] Review security logs
- [ ] Update dependencies (dev/staging first)

### Monthly Tasks

- [ ] Security patches
- [ ] Certificate renewal check
- [ ] Database optimization (VACUUM, ANALYZE)
- [ ] Backup restoration test
- [ ] Performance review

---

## 🚨 Incident Response

### Service Down

1. Check service status: `docker-compose ps`
2. Check logs: `docker-compose logs <service>`
3. Restart service: `docker-compose restart <service>`
4. Check Grafana for metrics
5. Check Loki for logs

### Database Issues

1. Check PostgreSQL status: `systemctl status postgresql`
2. Check connections: `SELECT count(*) FROM pg_stat_activity;`
3. Check disk space: `df -h`
4. Review slow queries: Check Grafana dashboard

### High CPU/Memory

1. Check Docker stats: `docker stats`
2. Check system resources: `htop`
3. Review Grafana Infrastructure dashboard
4. Scale services if needed

### Security Incident

1. Check auth logs: `/var/log/auth.log`
2. Check Nginx logs: `/var/log/nginx/`
3. Review firewall logs
4. Check for failed login attempts
5. Block malicious IPs

---

## 📞 Support Contacts

- **System Admin**: admin@shabouautopieces.tn
- **On-Call**: +216 XX XXX XXX
- **Hosting Provider**: [Provider support]
- **DNS Provider**: [DNS support]
- **SSL Provider**: Let's Encrypt (automated)

---

## 📚 Additional Resources

- [Backend Documentation](../backend/README.md)
- [API Documentation](https://api.shabouautopieces.tn/docs)
- [Monitoring Guide](../backend/monitoring/MONITORING.md)
- [Frontend Integration](../backend/FRONTEND-INTEGRATION.md)
- [Deployment Scripts](./scripts/)

---

**Last Updated**: $(date)
**Version**: 1.0.0
