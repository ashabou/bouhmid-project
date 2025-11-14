# Executive Summary

**Project**: Shabou Auto Pièces Backend Architecture
**Version**: 1.0
**Date**: 2025-11-14

---

## Overview

This document specifies the complete backend architecture for **Shabou Auto Pièces**, a modern e-commerce platform for a Tunisian auto parts business with 35+ years of industry expertise. The system is designed to support both public-facing e-commerce and private AI-powered business intelligence tools.

---

## Business Context

### The Business
- **Name**: Shabou Auto Pièces
- **Location**: Tunisia
- **Experience**: 35+ years in auto parts industry
- **Current State**: Traditional retail, limited digital presence
- **Goal**: Launch professional e-commerce platform with AI-driven operations

### Market Conditions
- **Target Market**: Tunisia (primary), North Africa (future)
- **Languages**: Arabic, French
- **Payment Methods**: Local payment gateways (future), WhatsApp ordering (Phase 1)
- **Competition**: Limited local e-commerce for auto parts
- **Opportunity**: First-mover advantage in digital auto parts retail

---

## System Objectives

### Primary Goals

1. **Public E-commerce Platform**
   - Product catalogue with 10,000+ auto parts
   - Advanced filtering (brand, category, vehicle compatibility, price)
   - Full-text search in French/Arabic
   - Product detail pages with specifications
   - WhatsApp-based ordering (Phase 1)
   - Future: Full cart, checkout, payment integration

2. **Private Admin Dashboard**
   - Product management (CRUD)
   - Inventory tracking
   - Price history and management
   - Access to AI agent insights

3. **AI Agent 1: "Prospector"**
   - Automated lead generation
   - Web scraping (Google Maps, supplier websites, marketplaces)
   - Competitor price monitoring
   - Lead scoring and prioritization
   - Weekly reports for business owner

4. **AI Agent 2: "Orion"**
   - Demand forecasting using ML
   - Seasonality analysis
   - Weather-based predictions
   - Restock alerts
   - Market trend analysis
   - Weekly insights and recommendations

---

## Core Architecture Decision

### Chosen Pattern: **Hybrid Modular Monolith**

```
Main API (Node.js) + Agent Microservices (Python) + Shared PostgreSQL
```

**Rationale:**
- **Monolith for API**: Faster development, simpler debugging, lower costs
- **Separate Agent Services**: Python's ML/scraping ecosystem is unmatched
- **Shared Database**: ACID guarantees, simpler operations, no eventual consistency
- **Migration Path**: Can extract modules to microservices when needed

### Technology Stack

| Component | Technology | Justification |
|-----------|------------|---------------|
| **Main API** | Node.js 20 + TypeScript | Industry standard, excellent ecosystem |
| **API Framework** | Fastify 4.x | 3x faster than Express, native TypeScript |
| **ORM** | Prisma | Type-safe, great migrations, excellent DX |
| **Database** | PostgreSQL 15 | Reliable, full-featured, handles 100k+ products |
| **Cache** | Redis 7 | Industry standard, multi-purpose (cache + queue) |
| **Agent Runtime** | Python 3.11+ | Best ML/scraping libraries |
| **Agent Framework** | FastAPI | Fast, async, matches Fastify philosophy |
| **ML Libraries** | scikit-learn, statsmodels, Prophet | Production-ready, well-documented |
| **Scraping** | Playwright, BeautifulSoup4 | Reliable, handles modern websites |
| **Job Queue** | Celery + Redis | Battle-tested for Python task scheduling |
| **Reverse Proxy** | Caddy 2 | Auto-HTTPS, simpler than Nginx |
| **Monitoring** | Prometheus + Grafana + Loki | Industry standard observability stack |
| **CI/CD** | GitHub Actions | Free, integrated, easy setup |

---

## System Architecture

### High-Level Diagram

```
                    ┌─────────────┐
                    │   USERS     │
                    │ (Tunisia)   │
                    └──────┬──────┘
                           │
                           │ HTTPS
                           ▼
                  ┌────────────────┐
                  │  CADDY PROXY   │
                  │  (Auto-HTTPS)  │
                  └────────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
     ┌─────────────────┐      ┌─────────────────┐
     │   MAIN API      │      │  AGENT SERVICES │
     │ (Node.js/       │◄────►│  (Python/       │
     │  Fastify)       │ REST │   FastAPI)      │
     │                 │      │                 │
     │ • Products      │      │ • Prospector    │
     │ • Brands        │      │ • Orion         │
     │ • Categories    │      │ • Celery        │
     │ • Search        │      │                 │
     │ • Admin         │      │                 │
     └────────┬────────┘      └────────┬────────┘
              │                        │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │     POSTGRESQL 15      │
              │                        │
              │  • Products            │
              │  • Brands/Categories   │
              │  • Leads (Prospector)  │
              │  • Forecasts (Orion)   │
              │  • Users (Admin)       │
              └────────────────────────┘
                           │
                           │
                           ▼
              ┌────────────────────────┐
              │       REDIS 7          │
              │                        │
              │  • HTTP Cache          │
              │  • Celery Job Queue    │
              │  • Rate Limiting       │
              │  • Session Store       │
              └────────────────────────┘
```

---

## Key Features

### Public E-commerce API

✅ **Product Catalogue**
- List products with pagination (cursor-based)
- Filter by: brand, category, price range, availability, vehicle compatibility
- Sort by: price, name, popularity, newest
- Cache-optimized (<200ms response time)

✅ **Full-Text Search**
- French/Arabic support
- Typo-tolerant (future: Meilisearch)
- Results in <300ms

✅ **Product Details**
- Comprehensive specifications
- Vehicle compatibility matrix
- Price history
- Related products
- High-quality images

✅ **WhatsApp Integration**
- "Order via WhatsApp" button
- Pre-filled message with product details
- Business phone number integration

### Admin Dashboard API

✅ **Product Management**
- CRUD operations with validation
- Bulk CSV import
- Price management with history tracking
- Image upload (future: Cloudflare R2)

✅ **Lead Management (from Prospector)**
- View discovered leads (suppliers, competitors)
- Filter by score, status, source
- Update lead status (contacted, qualified, converted)
- Price comparison against our catalogue

✅ **Forecast Insights (from Orion)**
- Weekly demand predictions
- Restock alerts (severity levels)
- Seasonal trend analysis
- Declining product warnings

### AI Agents

**Prospector Agent**
- **Frequency**: Daily scraping (2 AM)
- **Sources**:
  - Google Maps (via Google Places API)
  - Supplier websites (ethical scraping)
  - Future: Marketplaces (AliExpress, etc.)
- **Output**:
  - Leads with contact info
  - Competitor prices
  - Products without online presence
  - Lead scoring (0-100)

**Orion Agent**
- **Frequency**: Weekly forecasting (Sunday 3 AM)
- **Models**:
  - SARIMA (Seasonal ARIMA)
  - Facebook Prophet
  - Ensemble (weighted average)
- **Features**:
  - Historical sales patterns
  - Seasonality (summer/winter demand spikes)
  - Weather data integration
  - Tunisian holidays
  - Car fleet age distribution
- **Output**:
  - 4-week demand forecasts
  - Confidence intervals
  - Restock recommendations
  - Actionable insights

---

## Implementation Timeline

### Phase 1: MVP Backend (Week 1-2)
**Deliverable**: Functional e-commerce API

- ✅ Products, brands, categories CRUD
- ✅ Full-text search
- ✅ Filtering and sorting
- ✅ Redis caching
- ✅ API documentation (Swagger)
- ✅ Docker setup
- ✅ 80%+ test coverage

### Phase 2: Admin Dashboard (Week 3)
**Deliverable**: Admin can manage products

- ✅ JWT authentication
- ✅ Admin product management
- ✅ CSV import
- ✅ Price history tracking

### Phase 3: Agent Infrastructure (Week 4)
**Deliverable**: Agents running and collecting data

- ✅ Prospector scraping Google Maps
- ✅ Orion generating basic forecasts
- ✅ Celery scheduler setup
- ✅ Admin endpoints for leads/forecasts

### Phase 4: Advanced Forecasting (Week 5-6)
**Deliverable**: Production-grade ML forecasting

- ✅ SARIMA + Prophet models
- ✅ Feature engineering (weather, seasonality)
- ✅ Insights generation
- ✅ Model monitoring

### Phase 5: Deployment (Week 6-7)
**Deliverable**: Production system with monitoring

- ✅ VPS setup (DigitalOcean)
- ✅ CI/CD pipeline (GitHub Actions)
- ✅ Monitoring (Prometheus, Grafana, Loki)
- ✅ Automated backups
- ✅ Load testing

**Total Time**: 6-7 weeks to full production system

---

## Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Product Listing (p95) | <200ms | Users expect instant browsing |
| Product Detail (p95) | <100ms | Critical for conversion |
| Search (p95) | <300ms | Acceptable for complex queries |
| Cache Hit Ratio | >80% | Reduces DB load, improves speed |
| API Availability | 99.5% | 3.6 hours downtime/month acceptable for MVP |
| Concurrent Users | 500+ | Sufficient for Tunisian market |

---

## Cost Estimate

### Initial (MVP - Month 1-3)
| Item | Cost/Month |
|------|-----------|
| DigitalOcean Droplet (4GB RAM, 2 vCPU) | $24 |
| Backups (Cloudflare R2) | $1 |
| Google Places API | Free ($200 credit) |
| Domain + SSL | $0 (Caddy auto-HTTPS) |
| **Total** | **~$25/month** |

### At Scale (10k orders/month)
| Item | Cost/Month |
|------|-----------|
| DigitalOcean Droplet (8GB RAM, 4 vCPU) | $48 |
| Managed PostgreSQL (optional) | $15 |
| Cloudflare R2 (storage) | $5 |
| Meilisearch Cloud (search) | $29 |
| Monitoring (managed Grafana) | $0 (self-hosted) |
| **Total** | **~$97/month** |

**Scaling Path**: Stay under $200/month until $50k+ monthly revenue

---

## Risk Summary

### Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| PostgreSQL FTS won't scale >50k products | Medium | Migrate to Meilisearch when needed |
| Shared DB = single point of failure | High | Add read replica, implement backups |
| Monolith becomes spaghetti | Medium | Enforce module boundaries, refactor triggers |
| Insufficient sales data for ML | High | Require 1+ year history, use baselines if needed |
| Web scraping legal/ethical issues | High | Use Google Places API, respect robots.txt |

### Business Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Forecast accuracy too low (<70%) | Medium | Start with simple baselines, gradual rollout |
| Lead quality poor (spam/irrelevant) | Low | Lead scoring, manual review workflow |
| Integration with Lovable frontend | Medium | Clear API contract, staging environment |

**Full Risk Analysis**: See [Risks & Mitigations](./08-risks-and-mitigations.md)

---

## Success Criteria

### Technical Success
- ✅ API responses <200ms (p95)
- ✅ 99.5% uptime
- ✅ Zero data loss
- ✅ 80%+ cache hit ratio

### Business Success
- ✅ Admin can manage 10,000+ products efficiently
- ✅ Prospector finds 20+ qualified leads/week
- ✅ Orion forecast accuracy >70% MAE
- ✅ System handles 500+ concurrent users

### User Success
- ✅ Customers can find parts in <3 clicks
- ✅ Search returns relevant results in <1 second
- ✅ Mobile-responsive (frontend)
- ✅ WhatsApp ordering works seamlessly

---

## Next Steps

1. **For Development Team**: Review [Technical Architecture](./02-technical-architecture.md)
2. **For Database Engineers**: Review [Database Design](./03-database-design.md)
3. **For API Developers**: Review [API Specification](./04-api-specification.md)
4. **For Project Managers**: Review [Implementation Plan](./05-implementation-plan.md)
5. **For ML Engineers**: Review [Agent Architecture](./06-agent-architecture.md)
6. **For DevOps**: Review [Deployment Blueprint](./07-deployment-blueprint.md)

---

← [Back to Index](./00-INDEX.md) | [Next: Technical Architecture](./02-technical-architecture.md) →
