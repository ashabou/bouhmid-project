# Implementation Quick Start Guide

**Get the backend running in 6-7 weeks**

---

## Phase 1: MVP Backend (Week 1-2)

### Goal
Launch functional e-commerce API with products, search, and caching

### Tasks

**Day 1: Project Setup**
```bash
# Initialize Node.js project
mkdir api && cd api
npm init -y
npm install fastify @fastify/cors @fastify/helmet @fastify/jwt
npm install -D typescript @types/node ts-node tsx
npm install prisma @prisma/client zod bcrypt redis ioredis
npm install -D @types/bcrypt jest @types/jest supertest

# Initialize TypeScript
npx tsc --init

# Initialize Prisma
npx prisma init
```

**Day 2: Database Setup**
- Create `prisma/schema.prisma` with brands, categories, products, users tables
- Run migrations: `npx prisma migrate dev --name init`
- Create seed script with 100 sample products
- Test: `npx prisma studio` to view data

**Day 3-5: Core Modules**
- Create `src/modules/brands/` with CRUD operations
- Create `src/modules/categories/` with hierarchical tree support
- Create `src/modules/products/` with filtering, sorting, pagination
- Implement caching layer (Redis)
- Write unit tests for services

**Day 6-8: API Layer**
- Implement all public endpoints (see 04-api-specification.md)
- Add Zod validation schemas
- Add error handling middleware
- Write integration tests for routes

**Day 9-10: Performance & Caching**
- Integrate Redis caching
- Implement cache invalidation logic
- Add request logging (Winston)
- Load test with k6: `k6 run --vus 100 --duration 30s tests/load/products.js`

**Day 11: Documentation**
- Generate OpenAPI spec
- Write README with setup instructions
- Document environment variables

**Day 12: Deployment Prep**
- Create Dockerfile
- Create docker-compose.yml (Postgres + Redis + API)
- Test production build: `npm run build && node dist/server.js`

### Deliverables
✅ Functional REST API
✅ >80% test coverage
✅ Docker images ready
✅ API documentation (Swagger UI)

### Success Criteria
- Product listing: <200ms (p95)
- Product detail: <100ms (p95)
- Search: <300ms (p95)
- All tests passing

---

## Phase 2: Admin Dashboard APIs (Week 3)

### Goal
Enable admin to manage products, brands, categories

### Tasks

**Day 13-14: Auth System**
```bash
# Install dependencies
npm install @fastify/jwt bcrypt
```

- Create users table migration
- Implement JWT service (access + refresh tokens)
- Create login/logout/refresh endpoints
- Add auth middleware
- Test with Postman/Insomnia

**Day 15-16: Admin Product Management**
- POST /api/admin/products (create)
- PUT /api/admin/products/:id (update)
- DELETE /api/admin/products/:id (soft delete)
- Bulk CSV import endpoint
- Price history tracking

**Day 17: Admin Brand/Category Management**
- CRUD endpoints for brands
- CRUD endpoints for categories
- Handle parent/child relationships

**Day 18: Price History**
- Auto-create price_history on product update
- GET /api/admin/products/:id/price-history

**Day 19: Admin Dashboard Metrics**
- GET /api/admin/dashboard/stats
- GET /api/admin/dashboard/recent-activity

### Deliverables
✅ Admin can log in
✅ Admin can manage products via API
✅ CSV import functionality
✅ Audit trail for price changes

### Success Criteria
- Admin can create 100 products in <5 minutes (via CSV)
- Price changes tracked automatically
- Unauthorized users blocked (401/403)

---

## Phase 3: Agent Infrastructure (Week 4)

### Goal
Deploy Prospector and Orion agents

### Tasks

**Day 20-21: Python Agent Skeleton**
```bash
# Create Python projects
mkdir -p agents/{prospector,orion}
cd agents/prospector

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn celery redis sqlalchemy playwright beautifulsoup4
```

- Create FastAPI apps for both agents
- Docker Compose integration
- Health check endpoints

**Day 22-24: Prospector Agent**
- Implement Google Maps scraper (use Google Places API)
- Lead extraction logic
- Store leads in PostgreSQL
- Basic lead scoring (0-100)
- GET /prospector/leads API

**Day 25-26: Orion Agent Skeleton**
- CSV sales history importer
- Basic forecasting (moving average)
- Store forecasts in PostgreSQL
- GET /orion/forecasts API

**Day 27: Scheduler Setup**
```bash
pip install celery redis
```

- Create Celery tasks for Prospector (daily at 2 AM)
- Create Celery tasks for Orion (weekly on Sunday)
- Setup Celery Beat scheduler

**Day 28: Admin Integration**
- Add GET /api/admin/leads endpoint (proxy to Prospector)
- Add GET /api/admin/forecasts endpoint (proxy to Orion)
- Add PATCH /api/admin/leads/:id (update status)

### Deliverables
✅ Prospector scrapes Google Maps daily
✅ Orion generates basic forecasts weekly
✅ Admin can view leads and forecasts

### Success Criteria
- Prospector finds 20+ leads/day
- Orion generates forecasts for all products with sales history
- No crashes for 7 consecutive days

---

## Phase 4: Advanced Forecasting (Week 5-6)

### Goal
Production-grade ML forecasting with insights

### Tasks

**Day 29-31: Data Pipeline**
```bash
pip install pandas numpy scikit-learn statsmodels prophet
```

- ETL pipeline for sales_history
- Feature engineering (seasonality, weather, car age)
- Data validation and cleaning

**Day 32-35: ML Models**
- Implement SARIMA model
- Implement Facebook Prophet model
- Ensemble model (weighted average)
- Model training pipeline
- Save trained models to disk

**Day 36-37: Forecast Evaluation**
- Backtest on historical data (last 4 weeks)
- Calculate MAE, RMSE, MAPE
- Compare models and select best
- Target: MAPE <30%

**Day 38-40: Insights Generation**
- Build insight rules:
  - Restock alerts (demand > stock * 1.5)
  - Demand spikes (predicted > avg * 1.8)
  - Declining products (predicted < avg * 0.5)
- Store in forecast_insights table
- GET /api/admin/insights endpoint

**Day 41-42: Model Monitoring**
- Log model performance metrics
- Setup model retraining schedule (monthly)
- Alert on accuracy degradation

### Deliverables
✅ Production-grade demand forecasting
✅ Actionable insights for admin
✅ Automated model retraining

### Success Criteria
- Forecast accuracy: MAPE <30%
- Generate 10+ actionable insights/week
- Restock alerts prevent stockouts

---

## Phase 5: Deployment & Monitoring (Week 6-7)

### Goal
Production deployment with full observability

### Tasks

**Day 43-44: Production Environment**
```bash
# Provision DigitalOcean Droplet (4GB RAM, 2 vCPU)
# SSH to server
ssh root@your-server-ip

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose

# Clone repo
git clone https://github.com/ashabou/bouhmid-project.git
cd bouhmid-project

# Copy production environment
cp .env.example .env.production
# Edit .env.production with real values

# Start services
docker-compose -f docker-compose.prod.yml up -d
```

**Day 45-46: CI/CD Pipeline**
- Create `.github/workflows/deploy.yml`
- Configure GitHub Secrets (VPS_HOST, VPS_SSH_KEY)
- Test deployment: push to main, verify auto-deploy

**Day 47-48: Logging & Monitoring**
```bash
# Install monitoring stack
docker-compose up -d prometheus grafana loki
```

- Configure Prometheus scraping (API metrics)
- Create Grafana dashboards:
  - API latency (p50, p95, p99)
  - Error rate
  - Cache hit ratio
  - Database connections
- Configure Loki log aggregation

**Day 49: Backups**
```bash
# Create backup script
cat > /opt/shabou-autopieces/scripts/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec shabou_db pg_dump -U postgres shabou_autopieces | gzip > /backups/db_$DATE.sql.gz
# Upload to S3 (optional)
aws s3 cp /backups/db_$DATE.sql.gz s3://shabou-backups/
# Delete local backups older than 7 days
find /backups -name "db_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /opt/shabou-autopieces/scripts/backup.sh

# Add to crontab
crontab -e
# Add: 0 3 * * * /opt/shabou-autopieces/scripts/backup.sh
```

**Day 50: Error Alerting**
- Setup Prometheus Alertmanager
- Configure email/Slack alerts
- Test alerts: `docker-compose stop postgres` → should trigger alert

**Day 51-52: Load Testing**
```bash
# Install k6
wget https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz
tar -xzf k6-v0.47.0-linux-amd64.tar.gz
mv k6-v0.47.0-linux-amd64/k6 /usr/local/bin/

# Run load test
k6 run --vus 500 --duration 5m tests/load/full-scenario.js
```

- Run load tests simulating 500 concurrent users
- Identify bottlenecks
- Optimize (add indexes, tune cache TTLs)
- Document scaling plan

### Deliverables
✅ Production deployment on VPS
✅ Automated CI/CD
✅ Full observability stack
✅ Disaster recovery plan

### Success Criteria
- System handles 500 concurrent users
- Uptime >99.5%
- Alerts trigger on critical issues
- Backups run daily successfully

---

## Estimated Costs

### Development Phase (Month 1-2)
- DigitalOcean Droplet (4GB): $24/month
- Domain + SSL: $0 (Caddy auto-HTTPS)
- Backups (Cloudflare R2): $1/month
- Google Places API: Free ($200 credit)
**Total: ~$25/month**

### Production Phase (Month 3+)
- DigitalOcean Droplet (4GB): $24/month
- Managed PostgreSQL (optional): $15/month
- Cloudflare R2 (storage): $5/month
- Monitoring: $0 (self-hosted)
**Total: ~$44/month**

### At Scale (10k orders/month)
- DigitalOcean Droplet (8GB): $48/month
- Managed PostgreSQL: $15/month
- Meilisearch Cloud: $29/month
- Cloudflare R2: $5/month
**Total: ~$97/month**

---

## Risk Mitigation Checklist

### Week 1
- [ ] Verify sales history data exists (1+ year for ML)
- [ ] Confirm Lovable frontend API integration plan
- [ ] Setup staging environment

### Week 2
- [ ] Load test with realistic product count
- [ ] Verify cache hit ratio >60%
- [ ] Review security (Helmet, CORS, rate limiting)

### Week 3
- [ ] Test admin auth on multiple devices
- [ ] Verify JWT expiration works correctly
- [ ] Audit SQL queries for injection vulnerabilities

### Week 4
- [ ] Verify Google Places API quota (within free tier)
- [ ] Test Celery task retries on failure
- [ ] Check agent logs for errors

### Week 5
- [ ] Verify forecast accuracy on test set
- [ ] Ensure ML models persist correctly
- [ ] Test model retraining pipeline

### Week 6-7
- [ ] Test backup restore procedure
- [ ] Verify SSL certificate auto-renewal (Caddy)
- [ ] Load test production environment
- [ ] Document rollback procedure

---

## Common Pitfalls & Solutions

### Pitfall 1: PostgreSQL FTS too slow
**Symptom**: Search takes >500ms
**Solution**: Migrate to Meilisearch (see 08-risks-and-mitigations.md)

### Pitfall 2: Insufficient sales data
**Symptom**: ML forecasts wildly inaccurate
**Solution**: Fall back to moving average, warn admin

### Pitfall 3: Agent crashes repeatedly
**Symptom**: Celery workers keep restarting
**Solution**: Add better error handling, implement retry logic

### Pitfall 4: Cache invalidation bugs
**Symptom**: Stale data shown to users
**Solution**: Review invalidation logic, add cache version tags

### Pitfall 5: Deployment failures
**Symptom**: Docker containers won't start
**Solution**: Check logs (`docker-compose logs`), verify env vars

---

## Success Metrics

### Technical Metrics
- [ ] API response time <200ms (p95)
- [ ] Cache hit ratio >80%
- [ ] Uptime >99.5%
- [ ] Test coverage >80%
- [ ] Load test passes (500 concurrent users)

### Business Metrics
- [ ] Admin can manage 10,000+ products
- [ ] Prospector finds 20+ qualified leads/week
- [ ] Orion forecast accuracy >70% (MAPE <30%)
- [ ] Zero data loss incidents

### User Metrics
- [ ] Customers can find parts in <3 clicks
- [ ] Search returns results in <1 second
- [ ] WhatsApp ordering works seamlessly

---

## Next Steps After MVP

### Phase 6: Customer Features (Month 3)
- Customer registration/login
- Shopping cart
- Order placement
- Payment integration (local Tunisian gateways)

### Phase 7: Inventory Management (Month 4)
- Real-time inventory tracking
- Supplier management
- Purchase orders
- Stock alerts

### Phase 8: Advanced Features (Month 5-6)
- Multi-language (Arabic/French)
- Mobile app (React Native)
- Delivery tracking
- Customer reviews

---

← [Back to Index](./00-INDEX.md)
