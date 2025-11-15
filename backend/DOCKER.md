# Docker Setup Guide

Complete Docker configuration for Shabou Auto Pièces backend services.

## Table of Contents

- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Development](#development)
- [Production](#production)
- [Services](#services)
- [Environment Variables](#environment-variables)
- [Health Checks](#health-checks)
- [Troubleshooting](#troubleshooting)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Docker Network                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │   API    │  │Prospector│  │  Orion   │             │
│  │ Node.js  │  │  Python  │  │  Python  │             │
│  │  :3000   │  │  :8001   │  │  :8002   │             │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘             │
│       │             │             │                     │
│       └─────────────┴─────────────┘                     │
│                     │                                   │
│       ┌─────────────┴──────────────┐                    │
│       │                            │                    │
│  ┌────▼────────┐         ┌─────────▼────┐              │
│  │ PostgreSQL  │         │    Redis     │              │
│  │   :5432     │         │    :6379     │              │
│  └─────────────┘         └──────────────┘              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Services

| Service | Technology | Port | Purpose |
|---------|-----------|------|---------|
| **api** | Node.js 20 + Fastify | 3000 | Main e-commerce API |
| **prospector** | Python 3.11 + FastAPI | 8001 | Lead generation agent |
| **prospector_worker** | Celery | - | Background scraping tasks |
| **prospector_beat** | Celery Beat | - | Scheduled scraping jobs |
| **orion** | Python 3.11 + FastAPI | 8002 | ML forecasting agent |
| **orion_worker** | Celery | - | Background ML tasks |
| **orion_beat** | Celery Beat | - | Scheduled forecasting jobs |
| **postgres** | PostgreSQL 15 | 5432 | Database |
| **redis** | Redis 7 | 6379 | Cache + task queue |

---

## Quick Start

### Prerequisites

- Docker 24.0+
- Docker Compose V2

### 1. Clone and Setup

```bash
cd backend
cp .env.example .env
```

### 2. Edit Environment Variables

Edit `.env` and set:
- `JWT_SECRET` (min 32 characters)
- `JWT_REFRESH_SECRET` (min 32 characters)
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `GOOGLE_MAPS_API_KEY` (optional, for lead generation)

### 3. Start All Services

```bash
# Production mode
docker-compose up -d

# Development mode (with hot reload)
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

### 4. Run Database Migrations

```bash
# API migrations
docker-compose exec api npm run db:migrate:deploy
docker-compose exec api npm run db:seed

# Prospector migrations
docker-compose exec prospector alembic upgrade head

# Orion migrations
docker-compose exec orion alembic upgrade head
```

### 5. Verify Services

```bash
# Check all services are running
docker-compose ps

# Check API health
curl http://localhost:3000/api/v1/health

# Check Prospector health
curl http://localhost:8001/health

# Check Orion health
curl http://localhost:8002/health
```

---

## Development

### Development Setup

For local development, we recommend running only infrastructure services (PostgreSQL, Redis) in Docker and running the API/agents on your host machine for faster iteration.

#### Option 1: Infrastructure Only (Recommended)

```bash
# Start only PostgreSQL and Redis
docker-compose -f docker-compose.dev.yml up -d

# Run API locally
cd api
npm install
npm run dev

# Run Prospector locally (separate terminal)
cd agents/prospector
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001

# Run Orion locally (separate terminal)
cd agents/orion
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8002
```

#### Option 2: Full Docker with Hot Reload

```bash
# Uses docker-compose.override.yml automatically
docker-compose up

# View logs
docker-compose logs -f api
docker-compose logs -f prospector
docker-compose logs -f orion
```

### Development Tools

The development setup includes:

- **Adminer** (http://localhost:8080) - PostgreSQL GUI
- **RedisInsight** (http://localhost:8081) - Redis GUI

### Accessing Services

```bash
# API logs
docker-compose logs -f api

# Prospector logs
docker-compose logs -f prospector

# Database shell
docker-compose exec postgres psql -U postgres -d shabou_autopieces

# Redis CLI
docker-compose exec redis redis-cli

# Shell inside API container
docker-compose exec api sh

# Run tests
docker-compose exec api npm test
docker-compose exec prospector pytest
docker-compose exec orion pytest
```

---

## Production

### Production Deployment

```bash
# Build and start all services
docker-compose -f docker-compose.yml up -d --build

# View logs
docker-compose logs -f

# Scale services if needed
docker-compose up -d --scale api=3 --scale prospector_worker=2
```

### Production Checklist

- [ ] Set strong passwords for `POSTGRES_PASSWORD` and `REDIS_PASSWORD`
- [ ] Generate secure JWT secrets (min 32 chars, use `openssl rand -base64 32`)
- [ ] Configure `CORS_ORIGIN` with actual frontend domain
- [ ] Set `NODE_ENV=production` and `PYTHON_ENV=production`
- [ ] Configure email settings for notifications
- [ ] Setup automated backups (see below)
- [ ] Configure monitoring (Prometheus, Grafana)
- [ ] Setup reverse proxy (Caddy) with auto-HTTPS

### Backup & Restore

#### Database Backup

```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres shabou_autopieces > backup_$(date +%Y%m%d).sql

# Restore backup
docker-compose exec -T postgres psql -U postgres shabou_autopieces < backup_20231115.sql
```

#### Volume Backup

```bash
# Backup all volumes
docker run --rm \
  -v shabou_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres_data.tar.gz /data
```

---

## Services

### API Service

**Port:** 3000
**Health Check:** `GET /api/v1/health`

**Endpoints:**
- `GET /api/v1/products` - List products
- `GET /api/v1/products/:slug` - Get product details
- `GET /api/v1/brands` - List brands
- `GET /api/v1/categories` - List categories
- `POST /api/admin/auth/login` - Admin login

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST` - Redis host
- `JWT_SECRET` - JWT signing key
- `CORS_ORIGIN` - Allowed origins

### Prospector Service

**Port:** 8001
**Health Check:** `GET /health`

**Endpoints:**
- `GET /api/v1/leads` - List leads
- `POST /api/v1/scrape/google-maps` - Trigger Google Maps scrape
- `GET /api/v1/scrape/status/:job_id` - Check scraping job status

**Environment Variables:**
- `GOOGLE_MAPS_API_KEY` - Google Maps API key
- `CELERY_BROKER_URL` - Celery broker (Redis)

### Orion Service

**Port:** 8002
**Health Check:** `GET /health`

**Endpoints:**
- `GET /api/v1/forecasts` - Get forecasts
- `POST /api/v1/forecasts/generate` - Generate new forecast
- `GET /api/v1/insights` - Get demand insights
- `POST /api/v1/sales-history/import` - Import sales data

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `CELERY_BROKER_URL` - Celery broker (Redis)

---

## Environment Variables

See `.env.example` for all available environment variables.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | PostgreSQL password | `secure_password_123` |
| `JWT_SECRET` | JWT signing key | `min_32_characters_long_secret` |
| `JWT_REFRESH_SECRET` | JWT refresh token key | `min_32_characters_long_secret` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_MAPS_API_KEY` | For lead scraping | - |
| `REDIS_PASSWORD` | Redis password | Empty (dev) |
| `LOG_LEVEL` | Log verbosity | `info` |
| `CORS_ORIGIN` | Allowed origins | `*` |

---

## Health Checks

All services include health checks that Docker uses to determine service health.

### Check Service Health

```bash
# All services
docker-compose ps

# Specific service
docker-compose exec api curl http://localhost:3000/api/v1/health

# View health check logs
docker inspect --format='{{json .State.Health}}' shabou_api | jq
```

### Health Check Intervals

| Service | Interval | Timeout | Retries | Start Period |
|---------|----------|---------|---------|--------------|
| API | 30s | 10s | 3 | 40s |
| Prospector | 30s | 10s | 3 | 40s |
| Orion | 30s | 10s | 3 | 60s |
| PostgreSQL | 10s | 5s | 5 | 10s |
| Redis | 10s | 5s | 5 | 10s |

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs <service_name>

# Check service status
docker-compose ps

# Restart service
docker-compose restart <service_name>
```

### Database Connection Issues

```bash
# Check if PostgreSQL is ready
docker-compose exec postgres pg_isready -U postgres

# Check connection from API
docker-compose exec api node -e "require('./dist/shared/database/client.js').prisma.\$connect().then(() => console.log('OK'))"

# Check DATABASE_URL
docker-compose exec api env | grep DATABASE_URL
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker-compose exec redis redis-cli ping

# Check connection
docker-compose exec api node -e "require('ioredis').default({host:'redis'}).ping().then(console.log)"
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Change port in .env
API_PORT=3001
```

### Clean Restart

```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes data)
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Rebuild from scratch
docker-compose up -d --build --force-recreate
```

### Permission Issues

```bash
# Fix file permissions
sudo chown -R $USER:$USER .

# Fix volume permissions
docker-compose exec api chown -R nodejs:nodejs /app
```

### View Container Resource Usage

```bash
# Real-time stats
docker stats

# Container details
docker-compose top
```

---

## Performance Optimization

### Resource Limits

Add resource limits to `docker-compose.yml`:

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Database Connection Pool

Adjust in `api/src/config/database.config.ts`:
- `pool.min`: 2 (default)
- `pool.max`: 10 (adjust based on load)

### Redis Memory

Limit Redis memory:

```yaml
redis:
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

---

## Security

### Best Practices

1. **Never commit `.env` files**
2. **Use strong passwords** (min 16 characters)
3. **Rotate secrets regularly** (JWT, database passwords)
4. **Limit CORS origins** in production
5. **Enable TLS** for external connections
6. **Run as non-root user** (already configured in Dockerfiles)
7. **Keep images updated** (`docker-compose pull`)

### Security Scanning

```bash
# Scan images for vulnerabilities
docker scan shabou_api
docker scan shabou_prospector
docker scan shabou_orion
```

---

## Next Steps

- [ ] Setup CI/CD pipeline (TODO-161 to TODO-168)
- [ ] Configure monitoring (TODO-169 to TODO-176)
- [ ] Setup production deployment (TODO-181 to TODO-187)
- [ ] Configure automated backups
- [ ] Setup log aggregation

---

**Documentation Version:** 1.0
**Last Updated:** 2025-11-15
**Maintained by:** Shabou Auto Pièces Engineering Team
