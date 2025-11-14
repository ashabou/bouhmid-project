# Risks, Tradeoffs, and Critical Decisions

**Brutal honesty about what can go wrong and how to fix it**

---

## ⚠️ Technical Risks

### 1. PostgreSQL Full-Text Search Won't Scale

**Risk Level**: MEDIUM
**Likelihood**: High if >50k products
**Impact**: Search becomes slow (>500ms)

**Symptoms**:
- Search queries take >300ms (p95)
- Database CPU >70% during search
- Users complain about slow results

**Root Cause**:
PostgreSQL GIN indexes work well for <50k products, degrade after that.

**Immediate Mitigation**:
```sql
-- Optimize GIN index
CREATE INDEX CONCURRENTLY idx_products_search_optimized
ON products USING GIN(to_tsvector('french', name || ' ' || description || ' ' || sku))
WITH (fastupdate = off);

-- Analyze query plans
EXPLAIN ANALYZE
SELECT * FROM products
WHERE to_tsvector('french', name || ' ' || description) @@ plainto_tsquery('french', 'plaquettes frein');
```

**Long-Term Solution**:
Migrate to **Meilisearch** or **Typesense**:

```yaml
# docker-compose.yml
services:
  meilisearch:
    image: getmeili/meilisearch:latest
    ports:
      - "7700:7700"
    environment:
      MEILI_MASTER_KEY: ${MEILI_MASTER_KEY}
    volumes:
      - meilisearch_data:/data.ms
```

**Migration Plan**:
1. Run Meilisearch alongside PostgreSQL
2. Index all products nightly (Celery task)
3. A/B test search results (10% traffic to Meilisearch)
4. Monitor latency and relevance
5. Switch 100% traffic if results better
6. Keep PostgreSQL as source of truth

**Cost**: Meilisearch Cloud ~$29/month (managed) or $0 (self-hosted)

---

### 2. Shared Database = Single Point of Failure

**Risk Level**: HIGH
**Likelihood**: Medium
**Impact**: Entire system down if DB fails

**Symptoms**:
- API returns 500 errors
- "connection refused" in logs
- Agents can't write forecasts/leads

**Root Cause**:
All services depend on one PostgreSQL instance. No redundancy.

**Immediate Mitigation**:
```bash
# Daily backups (already in implementation plan)
0 3 * * * /opt/shabou-autopieces/scripts/backup.sh

# Test restore procedure monthly
docker exec shabou_db psql -U postgres -c "CREATE DATABASE test_restore;"
gunzip -c /backups/db_latest.sql.gz | docker exec -i shabou_db psql -U postgres test_restore
```

**Long-Term Solution (Phase 7+)**:
Add PostgreSQL **read replica** for analytics queries:

```yaml
# docker-compose.yml
services:
  postgres_primary:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_REPLICA_PASSWORD: ${REPLICA_PASSWORD}
    volumes:
      - ./postgresql.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf

  postgres_replica:
    image: postgres:15-alpine
    environment:
      PGPASSWORD: ${REPLICA_PASSWORD}
    command: |
      bash -c "
      until pg_basebackup --pgdata=/var/lib/postgresql/data -R --slot=replication_slot --host=postgres_primary --port=5432
      do
        echo 'Waiting for primary to be ready...'
        sleep 1s
      done
      postgres
      "
```

**Routing**:
- Write operations (API, Agents) → Primary
- Read operations (Forecasts, Leads) → Replica

**Cost**: +$24/month (DigitalOcean Droplet for replica) or migrate to Managed PostgreSQL ($15/month with auto-failover)

---

### 3. Node.js Monolith Will Become Spaghetti

**Risk Level**: MEDIUM
**Likelihood**: High if no discipline
**Impact**: Development slows, bugs increase

**Symptoms**:
- Circular dependencies
- Files >1000 lines
- Tests break when touching unrelated code
- "I don't know where to add this feature"

**Root Cause**:
Monoliths naturally accumulate tech debt without strict boundaries.

**Prevention Strategies**:

**1. Enforce Module Boundaries with ESLint**:
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../modules/*'],
            message: 'Do not import from sibling modules. Use shared/ or dependency injection.'
          }
        ]
      }
    ]
  }
};
```

**2. Dependency Injection**:
```typescript
// ❌ BAD: Direct imports create tight coupling
import { ProductService } from '../products/product.service';
const productService = new ProductService();

// ✅ GOOD: Inject dependencies
class OrderService {
  constructor(private productService: ProductService) {}
}

// app.ts
const productService = new ProductService(new ProductRepository());
const orderService = new OrderService(productService);
```

**3. Refactoring Triggers**:
Extract module to microservice if:
- Module has >15 files
- API response time >500ms (p95) for that module
- Module needs independent scaling (e.g., search)
- Module has different release cycle

**Example Extraction** (Search to Microservice):
```bash
# Create new search-service
mkdir search-service
cd search-service
npm init -y
# Copy src/modules/search/ to search-service/src/
# Add Fastify server on port 4000
# Update main API to proxy search requests:

# api/src/modules/search/search.routes.ts
fastify.get('/search', async (request, reply) => {
  const response = await fetch(`http://search-service:4000/search?${queryString}`);
  return response.json();
});
```

---

### 4. Insufficient Sales History Data for ML

**Risk Level**: CRITICAL
**Likelihood**: High
**Impact**: Forecasts wildly inaccurate

**Symptoms**:
- Orion predicts negative demand
- Forecast confidence <30%
- MAPE >50%

**Root Cause**:
ML models need 2+ years of data for seasonality. If business only has 6 months → poor forecasts.

**Pre-Implementation Check**:
```bash
# Before starting Phase 4, verify data:
# Minimum: 1 year (52 weeks)
# Optimal: 2-3 years
# Check: How many weeks of sales data exist?

SELECT
  COUNT(DISTINCT DATE_TRUNC('week', sale_date)) as weeks_of_data,
  MIN(sale_date) as earliest_sale,
  MAX(sale_date) as latest_sale
FROM sales_history;

-- If weeks_of_data < 52: STOP. Do not proceed to ML forecasting.
```

**Solutions**:

**If <1 year of data**:
1. Use **simple baselines** (moving average, not ML):
```python
# orion/app/forecasting/baseline.py
def moving_average_forecast(sales_df, weeks=4):
    """Simple 4-week moving average forecast"""
    return sales_df['quantity_sold'].rolling(window=weeks).mean().iloc[-1]
```

2. **Augment with industry data**:
- Scrape public competitor sales data
- Use Tunisia auto market reports
- Import industry seasonality patterns

**If 1-2 years of data**:
- Use **simpler models** (SARIMA only, not Prophet)
- Reduce forecast horizon (2 weeks instead of 4)
- Show low confidence warnings to admin

**If >2 years of data**:
- Full ML pipeline (SARIMA + Prophet + Ensemble)
- 4-week forecast horizon
- High confidence predictions

**Warning to Business Owner**:
"ML forecasting requires 2+ years of sales data. If you have less, we will use simple statistical methods (moving average) until more data is collected. Accuracy will improve over time."

---

### 5. Web Scraping Legal/Ethical Issues

**Risk Level**: HIGH
**Likelihood**: Medium
**Impact**: Legal threats, IP bans

**Problem**:
Automated web scraping can violate:
- Terms of Service (Google Maps ToS prohibits automated scraping)
- CFAA (Computer Fraud and Abuse Act) in some jurisdictions
- Personal data protection laws (GDPR in EU, similar in Tunisia)

**Legal Risks**:
- Cease and desist letters
- IP address bans
- Legal action (rare but possible)

**Recommended Approach**:

**1. Use Official APIs (Legal)**:
```python
# ✅ GOOD: Google Places API (legal, official)
import googlemaps

gmaps = googlemaps.Client(key='YOUR_API_KEY')

results = gmaps.places(query='auto parts Tunisia', type='car_repair')
for place in results['results']:
    details = gmaps.place(place_id=place['place_id'], fields=['name', 'phone', 'website'])
    # Store in database
```

**Cost**: $17 per 1000 requests, free tier $200/month → ~11,700 requests free

**2. Respect robots.txt (Ethical)**:
```python
# Check robots.txt before scraping
from urllib.robotparser import RobotFileParser

rp = RobotFileParser()
rp.set_url("https://example.com/robots.txt")
rp.read()

if rp.can_fetch("ShabouBot", "https://example.com/products"):
    # OK to scrape
else:
    # Do not scrape
```

**3. Rate Limiting (Polite)**:
```python
import time
import random

for url in urls:
    scrape(url)
    time.sleep(random.uniform(1, 3))  # 1-3 seconds between requests
```

**4. User-Agent Disclosure (Transparent)**:
```python
headers = {
    'User-Agent': 'Shabou Auto Parts Price Monitor (contact@shabouautopieces.tn)'
}
```

**5. Only Public Data (Legal)**:
- ✅ Scrape publicly visible prices
- ❌ Do not scrape login-protected content
- ❌ Do not scrape personal customer data

**Fallback if API Not Viable**:
Manual lead collection:
- Father manually adds competitor info to admin dashboard
- Not scalable but 100% legal

---

## 🤔 Architectural Tradeoffs

### Tradeoff 1: Monolith vs Microservices

**Decision**: Modular Monolith for API, Microservices for Agents

**Pros of Monolith**:
- ✅ Faster MVP (single deployment)
- ✅ Lower costs (one container)
- ✅ Simpler debugging (all logs in one place)
- ✅ Atomic transactions across modules

**Cons of Monolith**:
- ❌ Scaling: Must scale entire app (can't scale just search)
- ❌ Risk of tight coupling if not disciplined
- ❌ Single point of failure

**Why This Decision is Right**:
- For MVP (<10k products, <100 concurrent users): Monolith is faster and cheaper
- When to reconsider: If traffic >1000 concurrent users or >100k products

**Migration Path**:
Extract modules to microservices when:
1. Module becomes bottleneck (>500ms p95)
2. Module needs independent scaling
3. Module has different tech requirements (e.g., search → Elasticsearch)

---

### Tradeoff 2: PostgreSQL vs MongoDB

**Decision**: PostgreSQL

**Why PostgreSQL**:
- Auto parts = relational data (products → brands → categories)
- Forecasting = time series joins (sales → products → forecasts)
- Strong consistency needed for inventory (future)

**Why Not MongoDB**:
- Auto parts don't need schema flexibility
- Complex joins painful in MongoDB
- PostgreSQL FTS good enough for MVP

**When to Use MongoDB**:
- If product schema changes frequently (it won't)
- If need horizontal sharding (premature optimization)

---

### Tradeoff 3: REST vs GraphQL

**Decision**: REST API

**Why REST**:
- ✅ Simpler for frontend (Lovable may not support GraphQL well)
- ✅ Better caching (HTTP caching works out of the box)
- ✅ Lower learning curve for team
- ✅ Easier to debug (cURL, Postman)

**Why Not GraphQL**:
- Overkill for simple CRUD operations
- Over-fetching not a problem (product listings well-defined)
- N+1 query problem solvable with Prisma eager loading

**When to Reconsider GraphQL**:
- If frontend needs highly dynamic queries
- If mobile app needs fine-grained field selection

---

### Tradeoff 4: Server-Side Rendering vs API-Only

**Decision**: API-Only (Headless Backend)

**Why API-Only**:
- ✅ Frontend built with Lovable (separate deployment)
- ✅ Future mobile app can reuse same API
- ✅ Easier to version (API v1, v2)

**Tradeoff**:
- ❌ No SSR → worse SEO (mitigated with Next.js on frontend)

**SEO Strategy** (Frontend Responsibility):
- Use Next.js with SSR for product pages
- Generate sitemap from API
- Implement structured data (Schema.org)

---

## 🚨 Critical Decisions That Can't Be Changed Later

### Decision 1: Database Schema Design

**Why Critical**: Changing schemas post-launch = downtime + data migration

**Consequences**:
- Renaming columns requires multi-step deploy
- Changing data types risks data loss
- Adding constraints may fail on existing data

**How to Get It Right**:
1. **Review schema with team before Phase 1**
2. **Validate with sample data** (seed 10k products)
3. **Test queries for all use cases** (product listing, search, filtering)
4. **Future-proof**: Add JSONB columns for flexibility (`specifications`, `compatible_vehicles`)

**Schema Review Checklist**:
- [ ] All foreign keys have ON DELETE behavior defined
- [ ] Indexes on all filtered/sorted columns
- [ ] JSONB columns for flexible data
- [ ] UUIDs for distributed IDs (future-proof)
- [ ] Timestamps (created_at, updated_at) on all tables

---

### Decision 2: Authentication Strategy

**Why Critical**: Changing auth post-launch = all users must re-login

**Options**:
1. **JWT** (Chosen) - Simple, stateless, good for MVP
2. **OAuth** (Future) - For customer login (Google/Facebook)
3. **Session** (Rejected) - Requires sticky sessions (bad for scaling)

**Consequences**:
- Can't easily revoke JWTs (mitigated with refresh token whitelist in Redis)
- If JWT_SECRET leaked, must rotate + invalidate all tokens

**How to Get It Right**:
- ✅ Store JWT_SECRET in env vars (never commit)
- ✅ Rotate JWT_SECRET quarterly
- ✅ Use refresh token whitelist (can revoke)
- ✅ Monitor for suspicious login patterns

---

### Decision 3: API Versioning Strategy

**Why Critical**: Breaking API changes = angry frontend developers

**Decision**: URL-based versioning (`/api/v1/products`)

**Alternatives Rejected**:
- ❌ Header-based (`Accept: application/vnd.shabou.v1+json`) - Harder to debug
- ❌ No versioning - Breaking changes break frontend

**Versioning Rules**:
- **v1**: Never break backward compatibility
- **v2**: When breaking changes needed (e.g., rename field `currentPrice` → `price`)
- **Deprecation**: Support v1 for 6 months after v2 launch

**Migration Path**:
```typescript
// v1 (old)
GET /api/v1/products → { currentPrice: 100 }

// v2 (new)
GET /api/v2/products → { price: 100 }

// Support both for 6 months
// Then deprecate v1
```

---

## 🔮 Future-Proofing Strategies

### Strategy 1: Feature Flags

**Problem**: Need to test new features without full rollout

**Solution**: Feature flags via Redis

```typescript
// shared/features/feature-flags.ts
export async function isFeatureEnabled(featureName: string): Promise<boolean> {
  const value = await redis.get(`feature:${featureName}`);
  return value === 'true';
}

// Usage in code
if (await isFeatureEnabled('new-search-algorithm')) {
  return newSearch(query);
} else {
  return oldSearch(query);
}
```

**Benefits**:
- Test features with 10% of users
- Instant rollback (toggle flag)
- A/B testing

---

### Strategy 2: Gradual Rollouts

**Problem**: New deploy breaks production

**Solution**: Blue-Green Deployment

```bash
# Start new version on port 3001 (green)
docker run -d -p 3001:3000 shabou/api:v2

# Test new version
curl http://localhost:3001/api/v1/health

# If OK, switch Caddy traffic from 3000 (blue) to 3001 (green)
# Update Caddyfile: reverse_proxy api:3001

# If broken, instant rollback to 3000
```

---

### Strategy 3: Database Migrations Safety

**Problem**: Migration breaks production

**Solution**: Multi-Step Migrations for Breaking Changes

**Example**: Rename column `currentPrice` → `price`

**❌ DANGEROUS (One-Step)**:
```sql
-- This breaks API immediately!
ALTER TABLE products RENAME COLUMN current_price TO price;
```

**✅ SAFE (Three-Step)**:

**Step 1** (Deploy Week 1):
```sql
-- Add new column
ALTER TABLE products ADD COLUMN price DECIMAL(10, 2);

-- Backfill data
UPDATE products SET price = current_price;

-- Code reads BOTH columns (fallback logic)
SELECT current_price, price FROM products;
```

**Step 2** (Deploy Week 2):
```sql
-- Code now writes to BOTH columns
INSERT INTO products (current_price, price) VALUES (100, 100);
```

**Step 3** (Deploy Week 3):
```sql
-- Drop old column (safe now)
ALTER TABLE products DROP COLUMN current_price;

-- Code uses new column only
SELECT price FROM products;
```

---

## 📋 Pre-Launch Checklist

### Security
- [ ] All environment variables in `.env.production` (not committed)
- [ ] JWT_SECRET is 256-bit random (`openssl rand -hex 32`)
- [ ] Database password >16 characters
- [ ] CORS whitelist only production domains
- [ ] Rate limiting enabled (100 req/min global, 5 req/min auth)
- [ ] Helmet.js security headers active
- [ ] Input validation (Zod) on all endpoints
- [ ] SQL injection testing done (use sqlmap)
- [ ] XSS testing done (use OWASP ZAP)

### Performance
- [ ] Load tested with 500 concurrent users
- [ ] Product listing <200ms (p95)
- [ ] Product detail <100ms (p95)
- [ ] Search <300ms (p95)
- [ ] Cache hit ratio >80%
- [ ] Database connection pool <70% utilization

### Reliability
- [ ] Backups run daily successfully
- [ ] Backup restore tested
- [ ] Health check endpoint returns correct status
- [ ] Alerts trigger on critical failures
- [ ] Uptime monitoring setup (UptimeRobot or similar)

### Documentation
- [ ] README with setup instructions
- [ ] API documentation (Swagger UI)
- [ ] Architecture docs up to date
- [ ] Deployment runbook created
- [ ] Rollback procedure documented

---

← [Back to Index](./00-INDEX.md)
