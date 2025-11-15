# Open Risk Items - Backend System

This document lists critical risks and issues that **MUST** be resolved before production deployment.

**Last Updated:** 2025-01-15
**Production Readiness Score:** 59% (Needs 80%+ for launch)

---

## 🔴 P0 - Critical (Must Fix Before Launch)

These issues pose severe security, financial, or stability risks. **Do not deploy to production without fixing these.**

### RISK-001: Google Places API Cost Runaway 🔴

**Severity:** CRITICAL
**Category:** Cost Exposure
**Impact:** Could consume entire $300/month budget in days

**Problem:**
- Current code scrapes Google Places daily across 3 locations, 5 queries
- Each search can trigger 20 Place Details calls ($0.017 each)
- Estimated cost: **$200-500/month** for this feature alone
- No hard limits or kill switches implemented

**Evidence:**
- `/backend/agents/prospector/app/scheduler/tasks.py:61` - `daily_google_places_scrape`
- `/backend/agents/prospector/app/config.py:36` - No API call limits defined

**Required Actions:**
1. ✅ Implement `CostProtector` (created in shared library)
2. ⚠️ **TODO:** Integrate CostProtector into `daily_google_places_scrape` task
3. ⚠️ **TODO:** Change scraping frequency from daily to monthly
4. ⚠️ **TODO:** Set hard limits: `MAX_CALLS_PER_DAY=150`, `MAX_CALLS_PER_MONTH=4500`
5. ⚠️ **TODO:** Add Redis monitoring of API call counts
6. ⚠️ **TODO:** Configure GCP budget alerts at $100, $200, $250

**Status:** Partially mitigated (cost protection library created, not yet integrated)
**Owner:** Backend Team
**Deadline:** Before production launch

---

### RISK-002: CORS Wildcard Security Hole 🔴

**Severity:** CRITICAL
**Category:** Security
**Impact:** Any website can call your API, potential for abuse/data theft

**Problem:**
- `CORS_ORIGIN=*` configured in docker-compose.yml
- Allows any domain to make authenticated requests
- Opens door to CSRF attacks, data exfiltration

**Evidence:**
- `/backend/docker-compose.yml:72` - `CORS_ORIGIN: ${CORS_ORIGIN:-*}`
- `/backend/api/src/config/cors.config.ts` - Configured but allows wildcard

**Required Actions:**
1. ⚠️ **TODO:** Change docker-compose.yml to specific domains
   ```yaml
   CORS_ORIGIN: ${CORS_ORIGIN:-https://shabouautopieces.tn,https://www.shabouautopieces.tn}
   ```
2. ⚠️ **TODO:** Remove wildcard from all environment files
3. ⚠️ **TODO:** Add validation in API to reject wildcard
4. ⚠️ **TODO:** Test with actual frontend domain

**Status:** Not fixed
**Owner:** API Team
**Deadline:** Before production launch

---

### RISK-003: No Secret Management 🔴

**Severity:** CRITICAL
**Category:** Security
**Impact:** Credentials exposed in .env files, potential breach

**Problem:**
- Secrets stored in plaintext .env files
- .env files may be committed to git (even if .gitignored, they're in history)
- No rotation mechanism for JWT secrets, database passwords, API keys

**Evidence:**
- `/backend/.env.example` - All secrets as plaintext
- No integration with GCP Secret Manager, HashiCorp Vault, or similar

**Required Actions:**
1. ⚠️ **TODO:** Integrate GCP Secret Manager
   ```bash
   gcloud secrets create database-password --data-file=-
   gcloud secrets create jwt-secret --data-file=-
   gcloud secrets create google-places-api-key --data-file=-
   ```
2. ⚠️ **TODO:** Update docker-compose.yml to read from Secret Manager
3. ⚠️ **TODO:** Implement secret rotation policy (90 days for JWT, 180 days for DB)
4. ⚠️ **TODO:** Audit git history for leaked secrets, rotate any found

**Status:** Not started
**Owner:** DevOps Team
**Deadline:** Before production launch

---

### RISK-004: No Database Backups 🔴

**Severity:** CRITICAL
**Category:** Disaster Recovery
**Impact:** Complete data loss in case of corruption, deletion, or attack

**Problem:**
- No automated backup strategy documented or configured
- Cloud SQL backups not enabled
- No tested restore procedure
- RTO/RPO not defined

**Evidence:**
- No backup configuration in infrastructure code
- No backup monitoring or verification

**Required Actions:**
1. ⚠️ **TODO:** Enable Cloud SQL automated backups
   ```bash
   gcloud sql instances patch shabou-db \
     --backup-start-time 03:00 \
     --retained-backups-count 7
   ```
2. ⚠️ **TODO:** Test restore procedure monthly
3. ⚠️ **TODO:** Define RTO (Recovery Time Objective): 4 hours
4. ⚠️ **TODO:** Define RPO (Recovery Point Objective): 24 hours
5. ⚠️ **TODO:** Document restore runbook
6. ⚠️ **TODO:** Export backups to Cloud Storage (off-site)

**Status:** Not started
**Owner:** DBA/DevOps
**Deadline:** Week 1 after launch

---

### RISK-005: No TLS/HTTPS Enforcement 🔴

**Severity:** CRITICAL
**Category:** Security
**Impact:** Credentials transmitted in plaintext, susceptible to MITM attacks

**Problem:**
- Services communicate over HTTP, not HTTPS
- No TLS termination configured
- JWT tokens transmitted in clear text
- Database credentials in connection strings

**Evidence:**
- docker-compose.yml exposes ports without TLS
- No nginx/traefik reverse proxy with HTTPS

**Required Actions:**
1. ⚠️ **TODO:** Configure Let's Encrypt certificates
2. ⚠️ **TODO:** Add Traefik or nginx reverse proxy
3. ⚠️ **TODO:** Force HTTPS redirects (HTTP → HTTPS)
4. ⚠️ **TODO:** Enable HSTS headers (Strict-Transport-Security)
5. ⚠️ **TODO:** Test with SSL Labs (A+ rating required)

**Status:** Not started
**Owner:** DevOps Team
**Deadline:** Before production launch

---

### RISK-006: Database Schema Management Chaos 🔴

**Severity:** HIGH
**Category:** Architecture
**Impact:** Schema drift, conflicts, production database corruption

**Problem:**
- Three sources of truth for database schema:
  1. Prisma schema (API)
  2. SQLAlchemy models (Orion)
  3. SQLAlchemy models (Prospector)
- Alembic migration folders exist but are empty (no version history)
- No coordination between Prisma migrations and Alembic migrations
- Risk of schema conflicts when deploying

**Evidence:**
- `/backend/api/prisma/schema.prisma` - Prisma schema
- `/backend/agents/orion/app/models/` - SQLAlchemy models (duplicate definitions)
- `/backend/agents/prospector/app/models/` - SQLAlchemy models (duplicate definitions)
- `/backend/agents/prospector/alembic/versions/` - Empty directory

**Required Actions:**
1. ⚠️ **TODO:** Choose single source of truth:
   - **Option A (Recommended):** Prisma as source, generate SQLAlchemy models
   - **Option B:** SQLAlchemy as source, remove Prisma (major refactor)
2. ⚠️ **TODO:** Generate baseline Alembic migration for both agents
3. ⚠️ **TODO:** Create schema change coordination process
4. ⚠️ **TODO:** Add schema validation tests (ensure all services agree on schema)
5. ⚠️ **TODO:** Document migration procedures

**Status:** Not started
**Owner:** Backend Team + DBA
**Deadline:** Before first production deployment

---

## 🟠 P1 - High (Fix Within 1 Month of Launch)

These issues should be addressed soon after launch to prevent problems from escalating.

### RISK-007: Zero Test Coverage for Prospector 🟠

**Severity:** HIGH
**Category:** Quality Assurance
**Impact:** High bug risk in lead generation, scraping failures undetected

**Problem:**
- Prospector agent has **0 test files**
- Scraping logic completely untested
- Lead scoring algorithm untested
- No validation of scraped data quality

**Evidence:**
- `/backend/agents/prospector/tests/` - Directory does not exist
- Only 9 test files total across entire backend (API: 4, Orion: 5, Prospector: 0)

**Required Actions:**
1. ⚠️ **TODO:** Create test structure for Prospector
2. ⚠️ **TODO:** Add unit tests for scraping logic (target: 70% coverage)
3. ⚠️ **TODO:** Add integration tests for Google Places API calls (with mocks)
4. ⚠️ **TODO:** Add tests for lead scoring algorithm
5. ⚠️ **TODO:** Add tests for cost protection integration

**Status:** Not started
**Owner:** Backend Team
**Deadline:** 1 month after launch

---

### RISK-008: No CI/CD Pipeline 🟠

**Severity:** HIGH
**Category:** Development Workflow
**Impact:** Bugs ship to production, no automated quality checks

**Problem:**
- No GitHub Actions or GitLab CI configured
- Tests not run automatically on PRs
- No automated deployment
- Manual deployments prone to human error

**Evidence:**
- No `.github/workflows/` directory
- No `.gitlab-ci.yml` file

**Required Actions:**
1. ⚠️ **TODO:** Create GitHub Actions workflow for CI
   - Run tests on every PR
   - Lint code (ESLint, Prettier, Black, Flake8)
   - Build Docker images
   - Security scan (Trivy, Snyk)
2. ⚠️ **TODO:** Create CD workflow for staging deployment
3. ⚠️ **TODO:** Add manual approval gate for production
4. ⚠️ **TODO:** Automate database migrations in CI/CD

**Status:** Not started
**Owner:** DevOps Team
**Deadline:** 2 weeks after launch

---

### RISK-009: No Distributed Tracing 🟠

**Severity:** HIGH
**Category:** Observability
**Impact:** Can't debug issues across services, slow MTTR (Mean Time To Recovery)

**Problem:**
- Requests span API → Orion → Prospector with no correlation
- No request IDs in logs
- Can't trace a single user request end-to-end
- Debugging production issues is extremely difficult

**Evidence:**
- No OpenTelemetry or Jaeger integration
- Logs don't include request correlation IDs

**Required Actions:**
1. ⚠️ **TODO:** Implement OpenTelemetry
2. ⚠️ **TODO:** Add request ID generation in API
3. ⚠️ **TODO:** Propagate request IDs to agents via HTTP headers
4. ⚠️ **TODO:** Include request IDs in all log messages
5. ⚠️ **TODO:** Set up Jaeger or Zipkin for trace visualization

**Status:** Not started
**Owner:** Backend Team + SRE
**Deadline:** 1 month after launch

---

### RISK-010: No Rate Limiting on Agent APIs 🟠

**Severity:** HIGH
**Category:** Security + Cost
**Impact:** Agent APIs can be abused, runaway compute costs

**Problem:**
- Orion (port 8002) and Prospector (port 8001) have no rate limiting
- If ports are exposed, anyone can trigger expensive ML forecasts or scraping
- No authentication on agent endpoints

**Evidence:**
- `/backend/agents/orion/app/main.py` - No rate limiting middleware
- `/backend/agents/prospector/app/main.py` - No rate limiting middleware

**Required Actions:**
1. ⚠️ **TODO:** Add rate limiting to Orion/Prospector (slowapi or similar)
2. ⚠️ **TODO:** Add API key authentication for agent endpoints
3. ⚠️ **TODO:** Ensure ports 8001/8002 not exposed publicly (Cloud Run: requires auth)
4. ⚠️ **TODO:** Add IP allowlist for internal services only

**Status:** Not started
**Owner:** Backend Team
**Deadline:** Before production launch

---

## 🟡 P2 - Medium (Fix Within 3 Months)

These issues should be addressed but are not launch-blockers.

### RISK-011: Single Point of Failure - Database 🟡

**Severity:** MEDIUM
**Category:** Reliability
**Impact:** Database downtime = entire system down

**Problem:**
- Single PostgreSQL instance
- No read replicas for failover
- No multi-region setup
- Estimated downtime: Hours if primary DB fails

**Required Actions:**
1. ⚠️ **TODO:** Configure Cloud SQL read replica (europe-west1)
2. ⚠️ **TODO:** Route reporting queries to replica
3. ⚠️ **TODO:** Test failover procedure (primary → replica)
4. ⚠️ **TODO:** Document failover runbook

**Status:** Not started
**Owner:** DBA + DevOps
**Deadline:** 3 months after launch

---

### RISK-012: No Circuit Breakers 🟡

**Severity:** MEDIUM
**Category:** Reliability
**Impact:** Cascading failures if Orion/Prospector slow or down

**Problem:**
- API calls to Orion/Prospector have no circuit breaker
- If Orion is slow, API requests hang waiting for forecasts
- Can cause API service to become unresponsive

**Required Actions:**
1. ⚠️ **TODO:** Implement circuit breaker pattern (Polly, pybreaker)
2. ⚠️ **TODO:** Configure: 50% failure rate → open circuit for 30s
3. ⚠️ **TODO:** Return cached data or graceful error when circuit open
4. ⚠️ **TODO:** Monitor circuit breaker state in Grafana

**Status:** Not started
**Owner:** Backend Team
**Deadline:** 2 months after launch

---

### RISK-013: N+1 Query Problem in Product Listings 🟡

**Severity:** MEDIUM
**Category:** Performance
**Impact:** Slow API response times, high database load

**Problem:**
- Product listings don't eager load brand/category relationships
- 1 query for products + N queries for brands + N queries for categories
- Example: 100 products = 201 queries instead of 1

**Evidence:**
- `/backend/api/src/modules/products/product.service.ts` - No include/select optimization

**Required Actions:**
1. ⚠️ **TODO:** Add Prisma `include` for brand and category
2. ⚠️ **TODO:** Profile queries with pg_stat_statements
3. ⚠️ **TODO:** Add database query monitoring dashboard
4. ⚠️ **TODO:** Optimize slow queries (target: <50ms per query)

**Status:** Not started
**Owner:** Backend Team
**Deadline:** 2 months after launch

---

### RISK-014: ML Model Storage Not Scalable 🟡

**Severity:** MEDIUM
**Category:** Scalability
**Impact:** Can't scale Orion horizontally, models not shared across instances

**Problem:**
- ML models stored in Docker volume (orion_models)
- Volume is local to single container
- If Orion scales to multiple instances, each trains its own models
- Wastes compute, inconsistent predictions

**Evidence:**
- `/backend/docker-compose.yml:205` - `orion_models` local volume

**Required Actions:**
1. ⚠️ **TODO:** Store trained models in Cloud Storage
2. ⚠️ **TODO:** Load models from GCS on startup
3. ⚠️ **TODO:** Cache models in Redis for fast access
4. ⚠️ **TODO:** Add model versioning (track which model version made prediction)

**Status:** Not started
**Owner:** ML Team
**Deadline:** 3 months after launch

---

## 📊 Risk Summary

| Priority | Count | Must Fix Before Launch | Total Estimated Effort |
|----------|-------|------------------------|------------------------|
| P0 - Critical | 6 | Yes | 40-60 hours |
| P1 - High | 4 | Within 1 month | 30-40 hours |
| P2 - Medium | 4 | Within 3 months | 20-30 hours |
| **TOTAL** | **14** | **6 blockers** | **90-130 hours** |

---

## Resolution Tracking

### P0 Critical Issues - Must Fix Before Launch

- [ ] RISK-001: Google Places API Cost Runaway
  - [x] Create CostProtector library
  - [ ] Integrate into Prospector tasks
  - [ ] Change scraping to monthly
  - [ ] Add GCP budget alerts

- [ ] RISK-002: CORS Wildcard
  - [ ] Update docker-compose.yml
  - [ ] Test with real frontend domain

- [ ] RISK-003: No Secret Management
  - [ ] Set up GCP Secret Manager
  - [ ] Migrate all secrets
  - [ ] Document rotation policy

- [ ] RISK-004: No Database Backups
  - [ ] Enable Cloud SQL backups
  - [ ] Test restore procedure
  - [ ] Document runbook

- [ ] RISK-005: No TLS/HTTPS
  - [ ] Configure Let's Encrypt
  - [ ] Add reverse proxy (Traefik)
  - [ ] Test SSL configuration

- [ ] RISK-006: Schema Management
  - [ ] Choose single source of truth
  - [ ] Generate baseline migrations
  - [ ] Document coordination process

---

## Sign-Off

**Backend Readiness for Production:**
- [ ] All P0 issues resolved
- [ ] All P1 issues have mitigation plans
- [ ] Production Readiness Score ≥ 80%
- [ ] Load testing completed
- [ ] Security audit completed
- [ ] Disaster recovery tested

**Approved by:**
- [ ] Backend Lead: ________________ Date: __________
- [ ] Security Team: ________________ Date: __________
- [ ] DevOps Lead: _________________ Date: __________
- [ ] Product Manager: ______________ Date: __________

**Notes:**
- Do NOT deploy to production until all P0 issues are resolved
- Review this document weekly during development
- Update as new risks are identified
