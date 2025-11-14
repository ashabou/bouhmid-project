# Shabou Auto Pièces - Backend Architecture

**Complete Technical Specification for Production E-commerce System**

---

## 📖 Quick Access

This directory contains the complete backend architecture documentation for Shabou Auto Pièces, a professional e-commerce platform for a Tunisian auto parts business with 35+ years of expertise.

### Start Here
👉 **[00-INDEX.md](./00-INDEX.md)** - Complete navigation and overview

### Key Documents

| Document | Purpose | Audience |
|----------|---------|----------|
| **[01-executive-summary.md](./01-executive-summary.md)** | Business context, goals, architecture decisions | Everyone |
| **[02-technical-architecture.md](./02-technical-architecture.md)** | Tech stack, folder structure, auth, caching | Developers, Tech Leads |
| **03-database-design.md** | Complete PostgreSQL schema, ER diagrams, indexes | Database Engineers |
| **04-api-specification.md** | All API endpoints with request/response schemas | Frontend/Backend Devs |
| **05-implementation-plan.md** | 6-7 week phase-by-phase roadmap | Project Managers |
| **06-agent-architecture.md** | Prospector & Orion AI agents (scraping, forecasting) | ML Engineers, Data Scientists |
| **07-deployment-blueprint.md** | Docker, CI/CD, hosting, monitoring, backups | DevOps, SRE |
| **08-risks-and-mitigations.md** | Technical debt warnings, scaling limits, solutions | Tech Leads, Architects |

---

## 🏗️ Architecture at a Glance

### Hybrid Modular Monolith Pattern

```
Main API (Node.js/Fastify) + Agent Services (Python/FastAPI) + Shared PostgreSQL + Redis
```

**Why This Pattern?**
- **Monolith for API**: Faster development, simpler debugging, lower costs ($25/month MVP)
- **Separate Agents**: Python's ML/scraping ecosystem, isolated failures, independent scaling
- **Shared DB**: ACID guarantees, complex joins, single backup strategy

### Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Main API** | Node.js 20 + TypeScript + Fastify | 3x faster than Express, excellent DX |
| **Agents** | Python 3.11 + FastAPI + Celery | Best ML/scraping libraries |
| **Database** | PostgreSQL 15 | Handles 100k+ products, full-featured |
| **Cache** | Redis 7 | Multi-purpose (cache + queue) |
| **Proxy** | Caddy 2 | Auto-HTTPS, simple config |
| **Monitoring** | Prometheus + Grafana + Loki | Industry standard observability |

---

## 🎯 System Capabilities

### Public E-commerce Platform
✅ Product catalogue (10,000+ items)
✅ Advanced filtering (brand, category, vehicle compatibility, price)
✅ Full-text search (French/Arabic)
✅ WhatsApp ordering integration
✅ <200ms response time (p95)

### Private Admin Dashboard
✅ Product management (CRUD, bulk CSV import)
✅ Price history tracking
✅ Lead management (from Prospector agent)
✅ Demand forecasting insights (from Orion agent)
✅ JWT-based authentication

### AI Agent 1: Prospector (Lead Generation)
✅ Daily Google Maps scraping (via official API)
✅ Supplier website price monitoring
✅ Lead scoring (0-100)
✅ Competitor analysis
✅ Weekly reports for business owner

### AI Agent 2: Orion (Demand Forecasting)
✅ Weekly demand predictions using ML (SARIMA + Prophet)
✅ Seasonality analysis (Tunisia-specific)
✅ Weather-based forecasting
✅ Restock alerts
✅ Market trend analysis

---

## 📊 Key Metrics

### Performance Targets
- **Product Listing**: <200ms (p95)
- **Product Detail**: <100ms (p95)
- **Search**: <300ms (p95)
- **Cache Hit Ratio**: >80%

### Scalability
- **Products**: 100,000+ items supported
- **Concurrent Users**: 500+
- **Daily Requests**: 1M+

### Cost
- **MVP**: ~$25/month (DigitalOcean Droplet 4GB)
- **At Scale**: ~$100/month (until $50k+ monthly revenue)

---

## 🚀 Implementation Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Phase 1** | Week 1-2 | MVP Backend (Products, Search, API) |
| **Phase 2** | Week 3 | Admin Dashboard APIs |
| **Phase 3** | Week 4 | Agent Infrastructure (Prospector + Orion basics) |
| **Phase 4** | Week 5-6 | Advanced ML Forecasting |
| **Phase 5** | Week 6-7 | Production Deployment + Monitoring |

**Total**: 6-7 weeks to production-ready system

---

## ⚠️ Critical Decisions & Rationale

### 1. Why Fastify over Express?
**Decision**: Use Fastify 4.x
**Rationale**:
- 3x faster (45k req/sec vs 15k req/sec)
- Built-in schema validation
- Better TypeScript support
- Native async/await

### 2. Why Monolith for API?
**Decision**: Modular monolith, not microservices
**Rationale**:
- Faster MVP (single deployment)
- Lower costs (one container)
- Simpler debugging (all logs in one place)
- Can extract modules later if needed

### 3. Why Separate Python Services for Agents?
**Decision**: Python microservices for Prospector/Orion
**Rationale**:
- Python's ML ecosystem (Prophet, scikit-learn) unmatched
- Scraping libraries (Playwright) more mature
- Isolated failures (agent crash doesn't affect API)
- Independent scaling

### 4. Why PostgreSQL over MongoDB?
**Decision**: PostgreSQL 15+
**Rationale**:
- Auto parts = relational data (products → brands → categories)
- ACID guarantees for orders (future)
- Full-text search built-in (good enough for <50k products)
- Can scale to millions of rows

### 5. Why Shared Database?
**Decision**: Agents and API share one PostgreSQL
**Rationale**:
- Complex joins (products + forecasts + leads)
- No eventual consistency issues
- Single backup strategy
- Can add read replicas later if needed

---

## 🔒 Security Highlights

- ✅ JWT-based authentication (15min access, 7day refresh)
- ✅ bcrypt password hashing
- ✅ Rate limiting (100 req/min global, 5 req/min auth)
- ✅ CORS whitelist
- ✅ Helmet.js security headers
- ✅ Input validation (Zod schemas)
- ✅ SQL injection prevention (Prisma parameterized queries)

---

## 📈 Monitoring & Observability

- **Metrics**: Prometheus (API latency, error rate, cache hit ratio)
- **Dashboards**: Grafana (real-time visualizations)
- **Logs**: Loki + Winston (centralized log aggregation)
- **Alerts**: Alertmanager (email/Slack on critical issues)
- **Backups**: Daily PostgreSQL dumps to S3 (30-day retention)

---

## 🛠️ Development Workflow

### Local Setup
```bash
# Clone repo
git clone https://github.com/ashabou/bouhmid-project.git
cd bouhmid-project

# Start infrastructure (PostgreSQL + Redis)
docker-compose up -d postgres redis

# API setup
cd api
npm install
npx prisma migrate dev
npm run dev

# Agents setup
cd ../agents/prospector
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Testing
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Load testing
k6 run tests/load/product-listing.js
```

### Deployment
```bash
# CI/CD triggers on push to main
git push origin main

# GitHub Actions will:
# 1. Run tests
# 2. Build Docker images
# 3. Push to GitHub Container Registry
# 4. SSH to VPS and deploy
```

---

## 🎓 Learning Resources

### For New Team Members
1. **Start**: Read [Executive Summary](./01-executive-summary.md)
2. **Then**: Review [Technical Architecture](./02-technical-architecture.md)
3. **Finally**: Dive into specific areas (database, API, agents)

### For Frontend Developers
- **[04-api-specification.md](./04-api-specification.md)** - All endpoints with examples

### For Backend Developers
- **[02-technical-architecture.md](./02-technical-architecture.md)** - Folder structure, patterns
- **03-database-design.md** - Schema and relationships

### For ML Engineers
- **[06-agent-architecture.md](./06-agent-architecture.md)** - Prospector & Orion details

### For DevOps
- **[07-deployment-blueprint.md](./07-deployment-blueprint.md)** - Docker, CI/CD, monitoring

---

## 🤝 Contributing

When making architectural changes:
1. Update relevant documentation in this directory
2. Get approval from tech lead before major changes
3. Document tradeoffs and migration paths
4. Update version numbers and changelog

---

## 📞 Questions?

For architecture clarifications:
1. Check [08-risks-and-mitigations.md](./08-risks-and-mitigations.md) for known issues
2. Review specific documentation sections
3. Contact tech lead or senior architect

---

## 📝 Document Metadata

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Created** | 2025-11-14 |
| **Author** | Senior Backend Architect |
| **Status** | Foundation Architecture Document |
| **Next Review** | After Phase 1 completion (Week 2) |

---

**Navigate**: [Go to Complete Index](./00-INDEX.md) →
