# Shabou Auto Pièces - Backend Architecture Documentation

**Version:** 1.0
**Date:** 2025-11-14
**Status:** Foundation Architecture Document
**Author:** Senior Backend Architect
**Project:** Tunisian Auto Parts E-commerce Platform

---

## 📋 Table of Contents

This is the complete backend architecture specification for Shabou Auto Pièces, a professional e-commerce system for a 35+ year Tunisian auto parts business.

### Core Documentation

1. **[Executive Summary](./01-executive-summary.md)**
   - System overview
   - Core architectural decisions
   - Technology stack summary
   - Key metrics and goals

2. **[Technical Architecture](./02-technical-architecture.md)**
   - Complete technology stack with justifications
   - Architecture pattern (Hybrid Modular Monolith)
   - Folder structure (production-grade)
   - Authentication & authorization
   - Caching strategy
   - Performance optimization

3. **[Database Design](./03-database-design.md)**
   - Full PostgreSQL schema (DDL)
   - Entity-relationship diagrams
   - Indexing strategy
   - Query optimization patterns
   - Migration strategy

4. **[API Specification](./04-api-specification.md)**
   - Public e-commerce endpoints
   - Admin dashboard endpoints
   - Request/response schemas
   - Authentication flows
   - Error handling standards
   - Performance targets

5. **[Implementation Plan](./05-implementation-plan.md)**
   - Phase-by-phase roadmap (6-7 weeks)
   - Detailed task breakdowns
   - Dependencies and tradeoffs
   - MVP definition
   - Success criteria

6. **[Agent Architecture](./06-agent-architecture.md)**
   - **Prospector Agent**: Lead generation & web scraping
   - **Orion Agent**: Demand forecasting & ML pipeline
   - Scheduling and error handling
   - Model training and monitoring

7. **[Deployment Blueprint](./07-deployment-blueprint.md)**
   - Docker & Docker Compose setup
   - Reverse proxy configuration (Caddy)
   - CI/CD pipeline (GitHub Actions)
   - Hosting options analysis
   - Backup and disaster recovery
   - Monitoring & alerting (Prometheus, Grafana, Loki)

8. **[Risks & Mitigations](./08-risks-and-mitigations.md)**
   - Technical debt warnings
   - Scaling limitations
   - Data quality concerns
   - Security vulnerabilities
   - Mitigation strategies
   - When to refactor/migrate

---

## 🎯 Quick Start

### For Developers
1. Read [Technical Architecture](./02-technical-architecture.md) for system overview
2. Review [Database Design](./03-database-design.md) for data models
3. Check [API Specification](./04-api-specification.md) for endpoints

### For Product/Business
1. Start with [Executive Summary](./01-executive-summary.md)
2. Review [Implementation Plan](./05-implementation-plan.md) for timeline
3. Check [Risks & Mitigations](./08-risks-and-mitigations.md) for concerns

### For DevOps
1. Review [Deployment Blueprint](./07-deployment-blueprint.md)
2. Check [Technical Architecture](./02-technical-architecture.md) - Infrastructure section
3. Review monitoring and backup strategies

---

## 🏗️ System Architecture at a Glance

```
┌─────────────────────────────────────────────────────┐
│              SHABOU AUTO PIÈCES SYSTEM              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  PUBLIC FRONTEND           ADMIN DASHBOARD          │
│  (Lovable/React)          (Future React App)        │
│         │                        │                  │
│         └────────┬───────────────┘                  │
│                  │                                  │
│                  ▼                                  │
│         ┌────────────────┐                          │
│         │   CADDY PROXY  │                          │
│         │   (Auto-HTTPS) │                          │
│         └────────┬───────┘                          │
│                  │                                  │
│         ┌────────▼───────────────────────┐          │
│         │     MAIN API SERVICE          │          │
│         │     (Node.js/Fastify)         │          │
│         │                               │          │
│         │  • Products  • Search         │          │
│         │  • Brands    • Admin          │          │
│         │  • Categories                 │          │
│         └────────┬──────────────────────┘          │
│                  │                                  │
│         ┌────────┴───────────┐                     │
│         │                    │                     │
│    ┌────▼─────┐       ┌──────▼──────┐              │
│    │PostgreSQL│       │    Redis    │              │
│    │    15    │       │   Cache +   │              │
│    │          │       │  Job Queue  │              │
│    └────┬─────┘       └──────┬──────┘              │
│         │                    │                     │
│         └────────┬───────────┘                     │
│                  │                                  │
│         ┌────────▼───────────────────┐             │
│         │    AGENT SERVICES          │             │
│         │    (Python/FastAPI)        │             │
│         │                            │             │
│         │  • Prospector (Scraping)   │             │
│         │  • Orion (Forecasting)     │             │
│         │  • Celery Workers          │             │
│         └────────────────────────────┘             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 📊 Key Metrics & Targets

### Performance Targets
- **Product Listing**: <200ms (p95)
- **Product Detail**: <100ms (p95)
- **Search**: <300ms (p95)
- **Cache Hit Ratio**: >80%

### Scalability Targets
- **Products**: 100,000+ items
- **Concurrent Users**: 500+
- **Daily Requests**: 1M+

### Cost Targets
- **Initial Hosting**: <$50/month
- **At Scale (10k orders/month)**: <$200/month

### Availability
- **Uptime Target**: 99.5% (3.6 hours downtime/month acceptable for MVP)
- **Backup Frequency**: Daily
- **Backup Retention**: 30 days

---

## 🚀 Technology Stack Summary

### Main API
- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript 5.3+
- **Framework**: Fastify 4.x (3x faster than Express)
- **ORM**: Prisma (type-safe, great DX)

### Agent Services
- **Language**: Python 3.11+
- **Web Framework**: FastAPI
- **ML**: scikit-learn, statsmodels, Prophet
- **Scraping**: Playwright, BeautifulSoup4

### Infrastructure
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Search**: PostgreSQL FTS → Meilisearch (when >50k products)
- **Reverse Proxy**: Caddy 2 (auto-HTTPS)
- **Containers**: Docker + Docker Compose
- **Monitoring**: Prometheus + Grafana + Loki

---

## 📞 Support & Questions

For questions or clarifications about this architecture:
1. Review the specific documentation section
2. Check [Risks & Mitigations](./08-risks-and-mitigations.md) for known issues
3. Consult with the development team

---

## 🔄 Document Updates

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-14 | Initial architecture document | Senior Backend Architect |

---

**Next Steps**: Begin with [Executive Summary](./01-executive-summary.md) →
