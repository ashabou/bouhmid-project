# GCP Cost-Optimized Deployment Plan ($300/month Budget)

**Last Updated:** 2025-11-15
**Budget:** $300/month total
**Objective:** Deploy minimal viable e-commerce platform with scale-to-zero architecture

---

## 1. MVP SLICE - What Gets Deployed NOW

### ✅ ESSENTIAL COMPONENTS (DEPLOY)

#### **Frontend**
- React/Vite SPA
- **Hosting:** Firebase Hosting (FREE)
- **CDN:** Included with Firebase
- **SSL:** Automatic HTTPS
- **Cost:** $0/month

#### **Main API Service** (Node.js/Fastify)
- Core e-commerce endpoints:
  - Products (list, detail, search, filter)
  - Brands (read-only)
  - Categories (read-only)
  - Public search/autocomplete
- **Hosting:** Cloud Run (scale-to-zero)
- **Min instances:** 0
- **Max instances:** 5
- **CPU:** 1 vCPU
- **Memory:** 512 MB
- **Cost:** ~$10-30/month (based on actual traffic)

#### **PostgreSQL Database**
- Products, Brands, Categories, Users (admin only)
- Price history (essential for business logic)
- **Hosting:** Supabase (see section 4)
- **Cost:** $0-25/month (see comparison below)

#### **Redis Cache** (Optional - Phase 2)
- **Hosting:** Upstash (serverless)
- **Free tier:** 10,000 commands/day
- **Cost:** $0-10/month

### ❌ DISABLED COMPONENTS (POSTPONE)

#### **Prospector Agent** - POSTPONED
- **Why:** Google Places API costs ~$1,800/day × $0.032/search = **$58/day = $1,740/month** 🚨
- **Alternative:** Manual lead entry via admin panel
- **Future:** Enable when revenue > $1,000/month

#### **Orion Agent** - POSTPONED
- **Why:** ML model training + continuous forecasting = expensive compute
- **Alternative:** Basic inventory alerts in admin dashboard
- **Future:** Enable when product catalog > 500 items with sales history

#### **Celery Workers + Beat** - DISABLED
- **Why:** No scheduled jobs needed for MVP
- **Cost saved:** ~$20-40/month in continuous compute

#### **Monitoring Stack** - MINIMAL ONLY
- **Disabled:** Self-hosted Prometheus, Loki, Grafana, AlertManager
- **Why:** Stack requires 3+ containers running 24/7 (~$50-100/month)
- **Alternative:**
  - Cloud Run built-in metrics (FREE)
  - Cloud Logging (FREE tier: 50 GB/month)
  - Uptime checks via Cloud Monitoring (FREE)
  - Error tracking: Sentry free tier (5K events/month)

#### **Authentication** - SIMPLIFIED
- **Disabled:** Customer authentication (Phase 2)
- **Kept:** Admin-only JWT authentication
- **Why:** MVP is catalog browsing + admin management only
- **Cost saved:** Simpler session management

---

## 2. COMPONENTS TO DISABLE/POSTPONE

### Immediate Removals

| Component | Reason | Monthly Cost Saved | Alternative |
|-----------|--------|-------------------|-------------|
| **Google Places API** | $1,740/month quota | $1,740 | Manual lead entry |
| **Prospector Agent** | No API = no purpose | $30-50 | Admin CSV import |
| **Orion Agent** | No sales data yet | $40-60 | Excel forecasting |
| **Celery Infrastructure** | No scheduled jobs | $30-40 | Manual triggers via API |
| **Self-hosted Monitoring** | GCP provides basics | $50-100 | Cloud Run metrics |
| **Redis (initial)** | Low traffic = cache not critical | $10-20 | Deploy when needed |
| **Customer Auth** | No orders in MVP | $5-10 | Admin-only access |
| **Email Alerts** | No users to alert | $0 (SMTP free) | Phase 2 |

**Total Saved:** ~$1,905-2,020/month 🎉

### Phase 2 Additions (When Revenue > $500/month)
1. Redis caching (Upstash serverless)
2. Customer authentication
3. Email notifications
4. Basic monitoring (lightweight)

### Phase 3 Additions (When Revenue > $1,000/month)
1. Prospector Agent with limited API quota ($100/month budget)
2. Basic demand forecasting (simplified Orion)
3. Scheduled data cleanup jobs

---

## 3. REVISED DEPLOYMENT ARCHITECTURE

### Scale-to-Zero Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT BROWSER                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  FIREBASE HOSTING (FREE)                                     │
│  - React SPA (Static Files)                                  │
│  - Auto HTTPS + CDN                                          │
│  - ~0 ms cold start                                          │
└───────────────────────┬─────────────────────────────────────┘
                        │ API Calls
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  CLOUD RUN - API SERVICE (Scale-to-Zero)                     │
│  - Min instances: 0 (scales down when idle)                  │
│  - Max instances: 5 (controls max cost)                      │
│  - 512 MB RAM / 1 vCPU                                       │
│  - Startup: ~2-3s cold start                                 │
│  - Request timeout: 60s                                      │
│  - Concurrency: 80 requests/instance                         │
│                                                              │
│  Endpoints:                                                  │
│    GET  /api/products (with search, filter)                  │
│    GET  /api/products/:id                                    │
│    GET  /api/brands                                          │
│    GET  /api/categories                                      │
│    POST /api/admin/auth/login                                │
│    POST /api/admin/products (CRUD)                           │
│    POST /api/admin/bulk-import (CSV)                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  SUPABASE (Database + Auth + Storage)                        │
│  - PostgreSQL 15                                             │
│  - 500 MB database (Free tier)                               │
│  - 1 GB file storage                                         │
│  - Auto backups (daily)                                      │
│  - ~50 ms latency                                            │
└─────────────────────────────────────────────────────────────┘

FUTURE ADDITIONS (Phase 2):
┌──────────────────────┐
│ UPSTASH REDIS        │  ◄── Add when traffic grows
│ (Serverless Cache)   │
└──────────────────────┘

┌──────────────────────┐
│ CLOUD SCHEDULER      │  ◄── Manual triggers initially
│ (Triggered Tasks)    │      $0.10/job/month
└──────────────────────┘
```

### Key Principles

1. **Scale-to-Zero:** Cloud Run scales to 0 instances when idle = $0 cost
2. **Free Tier Maximization:** Firebase, Supabase, Cloud Logging free tiers
3. **No Always-On Services:** No containers running 24/7
4. **Manual Over Automated:** Admin triggers tasks vs scheduled workers
5. **Lazy Loading:** Add services only when traffic demands it

---

## 4. DATABASE HOSTING COMPARISON

### Option 1: Supabase (RECOMMENDED for MVP) ⭐

**Free Tier:**
- PostgreSQL 15 with 500 MB storage
- Unlimited API requests (rate-limited)
- 1 GB file storage
- Daily backups (7-day retention)
- Built-in Row Level Security
- Auto-generated REST API
- Built-in Auth (bonus for Phase 2)

**Paid Tier ($25/month):**
- 8 GB database storage
- 100 GB bandwidth
- 7-day Point-in-Time Recovery
- Daily backups (30-day retention)

**Pros:**
- ✅ FREE to start (perfect for MVP)
- ✅ Generous free tier
- ✅ Automatic backups
- ✅ Built-in APIs (can skip some API code)
- ✅ Auth included (Phase 2 ready)
- ✅ Edge functions (optional)
- ✅ No cold starts (always-on DB)

**Cons:**
- ❌ Free tier limited to 500 MB (upgrade at ~300 products)
- ❌ Shared infrastructure (not dedicated)
- ❌ EU/US regions only (latency to Tunisia ~100-150ms)

**Estimated Cost:**
- Month 1-3: $0 (free tier)
- Month 4+: $25/month (when data grows)

---

### Option 2: Neon (Serverless Postgres)

**Free Tier:**
- 512 MB storage
- 1 compute branch
- Auto-suspend after 5 min inactivity
- 100 hours compute/month

**Paid Tier ($19/month Launch):**
- 10 GB storage
- Unlimited compute hours
- 3 compute branches
- 7-day history

**Pros:**
- ✅ True serverless (auto-suspend)
- ✅ Branching (instant dev environments)
- ✅ Free tier generous for MVP
- ✅ Fast cold starts (~1s)

**Cons:**
- ❌ Free tier has compute hour limits
- ❌ Need to monitor monthly hours
- ❌ Less mature than Supabase
- ❌ Cold starts (though fast)

**Estimated Cost:**
- Month 1-2: $0 (if usage < 100 hours)
- Month 3+: $19/month (unlimited compute)

---

### Option 3: Railway

**Free Trial:**
- $5 free credit (lasts ~2-3 weeks)

**Paid:**
- $5/month base + usage
- PostgreSQL ~$10-15/month for small DB

**Pros:**
- ✅ Easy deployment
- ✅ Integrated with apps (deploy API + DB together)
- ✅ Good DX

**Cons:**
- ❌ NO long-term free tier
- ❌ More expensive than Supabase/Neon
- ❌ Pay from day 1 after trial

**Estimated Cost:**
- $15-25/month from start

---

### Option 4: Cloud SQL (GCP Native)

**Pricing:**
- Shared-core f1-micro: ~$7/month (0.6 GB RAM)
- db-f1-micro (dedicated): ~$15/month (1.7 GB RAM)
- Storage: $0.17/GB/month
- Backups: $0.08/GB/month

**Pros:**
- ✅ Native GCP integration
- ✅ Same region as Cloud Run (low latency)
- ✅ Production-grade

**Cons:**
- ❌ NO free tier
- ❌ Minimum ~$15-20/month
- ❌ Always-on (no scale-to-zero)
- ❌ High % of your $300 budget

**Estimated Cost:**
- $20-35/month (minimum)

---

### RECOMMENDATION: Supabase

**Month 1-3 Plan:**
- Use Supabase FREE tier
- Monitor storage usage
- Budget: $0/month

**Month 4+ Plan:**
- Upgrade to Supabase Pro ($25/month)
- Or migrate to Neon Launch ($19/month) if compute hours are issue

**Why Supabase wins:**
1. Start completely FREE
2. Built-in auth saves development time
3. Auto-backups included
4. Can use built-in APIs (optional optimization)
5. Easy upgrade path
6. Leaves $275-300/month for compute

---

## 5. STEP-BY-STEP DEPLOYMENT PLAN

### Prerequisites

1. **GCP Project Setup**
   ```bash
   # Create GCP project
   gcloud projects create bouhmid-mvp --name="Bouhmid MVP"
   gcloud config set project bouhmid-mvp

   # Enable required APIs
   gcloud services enable run.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable secretmanager.googleapis.com
   gcloud services enable logging.googleapis.com
   ```

2. **Supabase Account**
   - Sign up at https://supabase.com
   - Create new project: "bouhmid-production"
   - Note: Project URL, anon key, service_role key

3. **Firebase Account**
   - Sign up at https://firebase.google.com
   - Create project (use existing GCP project)
   - Enable Firebase Hosting

---

### Phase 1: Database Setup (Day 1)

#### Step 1.1: Initialize Supabase Database

1. **Run Prisma Migrations:**
   ```bash
   # Set Supabase connection string
   export DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

   # Generate Prisma client
   cd backend/api
   npm install
   npx prisma generate

   # Run migrations
   npx prisma migrate deploy

   # Seed initial data (brands, categories)
   npx prisma db seed
   ```

2. **Verify Database:**
   ```bash
   # Check tables
   npx prisma studio
   # Or use Supabase web interface
   ```

3. **Create Admin User:**
   ```sql
   -- Run in Supabase SQL Editor
   INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at)
   VALUES (
     gen_random_uuid(),
     'admin@bouhmid.tn',
     -- Hash: "changeme123" (bcrypt)
     '$2b$10$rQ3qZ8qZ8qZ8qZ8qZ8qZ8qZ8qZ8qZ8qZ8qZ8qZ8qZ8qZ8qZ8qZ8q',
     'ADMIN',
     true,
     now(),
     now()
   );
   ```

4. **Enable Row Level Security (RLS):**
   ```sql
   -- Products table (public read)
   ALTER TABLE products ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
   CREATE POLICY "Admin full access products" ON products USING (auth.role() = 'authenticated');

   -- Repeat for brands, categories
   ```

---

### Phase 2: API Deployment to Cloud Run (Day 1-2)

#### Step 2.1: Prepare Environment Variables

Create `.env.production`:
```env
# Database (Supabase)
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-characters-long

# CORS
CORS_ORIGIN=https://bouhmid-mvp.web.app
FRONTEND_URL=https://bouhmid-mvp.web.app

# Node Environment
NODE_ENV=production
PORT=8080

# Redis (disabled for now)
# REDIS_ENABLED=false

# Logging
LOG_LEVEL=info

# API Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
```

#### Step 2.2: Create GCP Secrets

```bash
# Navigate to API directory
cd backend/api

# Create secrets in Secret Manager
echo -n "postgresql://..." | gcloud secrets create DATABASE_URL --data-file=-
echo -n "your-jwt-secret" | gcloud secrets create JWT_SECRET --data-file=-
echo -n "your-jwt-refresh-secret" | gcloud secrets create JWT_REFRESH_SECRET --data-file=-

# Grant Cloud Run access to secrets
gcloud secrets add-iam-policy-binding DATABASE_URL \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding JWT_SECRET \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding JWT_REFRESH_SECRET \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

#### Step 2.3: Build and Deploy API

1. **Create Production Dockerfile** (`backend/api/Dockerfile.production`):
   ```dockerfile
   FROM node:20-alpine AS builder

   WORKDIR /app

   # Copy package files
   COPY package*.json ./
   COPY prisma ./prisma/

   # Install dependencies
   RUN npm ci --only=production
   RUN npx prisma generate

   # Copy source
   COPY . .

   # Build TypeScript
   RUN npm run build

   # Production image
   FROM node:20-alpine

   WORKDIR /app

   # Copy built files
   COPY --from=builder /app/dist ./dist
   COPY --from=builder /app/node_modules ./node_modules
   COPY --from=builder /app/package*.json ./
   COPY --from=builder /app/prisma ./prisma

   # Health check
   HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
     CMD node -e "require('http').get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

   EXPOSE 8080

   CMD ["node", "dist/server.js"]
   ```

2. **Deploy to Cloud Run:**
   ```bash
   cd backend/api

   # Build and deploy in one command
   gcloud run deploy bouhmid-api \
     --source . \
     --region us-central1 \
     --platform managed \
     --allow-unauthenticated \
     --min-instances 0 \
     --max-instances 5 \
     --cpu 1 \
     --memory 512Mi \
     --timeout 60s \
     --concurrency 80 \
     --set-env-vars "NODE_ENV=production,PORT=8080,CORS_ORIGIN=https://bouhmid-mvp.web.app,FRONTEND_URL=https://bouhmid-mvp.web.app" \
     --set-secrets "DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest" \
     --ingress all \
     --port 8080
   ```

3. **Verify Deployment:**
   ```bash
   # Get service URL
   gcloud run services describe bouhmid-api --region us-central1 --format="value(status.url)"

   # Test health endpoint
   curl https://bouhmid-api-XXX-uc.a.run.app/health

   # Test products endpoint
   curl https://bouhmid-api-XXX-uc.a.run.app/api/products
   ```

4. **Configure Custom Domain (Optional):**
   ```bash
   # Add custom domain
   gcloud run domain-mappings create \
     --service bouhmid-api \
     --domain api.bouhmid.tn \
     --region us-central1

   # Update DNS records as instructed
   ```

---

### Phase 3: Frontend Deployment to Firebase (Day 2)

#### Step 3.1: Configure Frontend for Production

1. **Update Environment Variables** (`.env.production`):
   ```env
   VITE_API_BASE_URL=https://bouhmid-api-XXX-uc.a.run.app/api
   VITE_ENVIRONMENT=production
   ```

2. **Build Frontend:**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

#### Step 3.2: Initialize Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize hosting
firebase init hosting

# Select:
# - Use existing project (bouhmid-mvp)
# - Public directory: dist
# - Single-page app: Yes
# - GitHub deploys: No (for now)
```

#### Step 3.3: Deploy Frontend

```bash
# Deploy
firebase deploy --only hosting

# Get hosting URL
firebase hosting:channel:list
# Output: https://bouhmid-mvp.web.app
```

#### Step 3.4: Update CORS in API

```bash
# Update Cloud Run service with correct CORS origin
gcloud run services update bouhmid-api \
  --region us-central1 \
  --update-env-vars "CORS_ORIGIN=https://bouhmid-mvp.web.app"
```

---

### Phase 4: CI/CD Setup (Day 3)

#### Step 4.1: Create Minimal GitHub Actions

**`.github/workflows/deploy-api.yml`**:
```yaml
name: Deploy API to Cloud Run

on:
  push:
    branches: [main]
    paths:
      - 'backend/api/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - id: auth
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy bouhmid-api \
            --source ./backend/api \
            --region us-central1 \
            --platform managed \
            --allow-unauthenticated \
            --min-instances 0 \
            --max-instances 5 \
            --cpu 1 \
            --memory 512Mi
```

**`.github/workflows/deploy-frontend.yml`**:
```yaml
name: Deploy Frontend to Firebase

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install and Build
        working-directory: ./frontend
        run: |
          npm ci
          npm run build

      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
          projectId: bouhmid-mvp
```

#### Step 4.2: Setup GitHub Secrets

```bash
# Create GCP Service Account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployer"

# Grant permissions
gcloud projects add-iam-policy-binding bouhmid-mvp \
  --member="serviceAccount:github-actions@bouhmid-mvp.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding bouhmid-mvp \
  --member="serviceAccount:github-actions@bouhmid-mvp.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Create key
gcloud iam service-accounts keys create key.json \
  --iam-account=github-actions@bouhmid-mvp.iam.gserviceaccount.com

# Add to GitHub Secrets:
# - GCP_SA_KEY (content of key.json)
# - FIREBASE_SERVICE_ACCOUNT (from Firebase console)
```

---

### Phase 5: Monitoring & Alerts (Day 3)

#### Step 5.1: Enable Cloud Logging

1. **Install Winston Cloud Logging Transport** (already in your API):
   ```typescript
   // backend/api/src/lib/logger.ts
   import { LoggingWinston } from '@google-cloud/logging-winston';

   const loggingWinston = new LoggingWinston({
     projectId: 'bouhmid-mvp',
     keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
   });

   const logger = winston.createLogger({
     transports: [
       new winston.transports.Console(),
       loggingWinston, // Add this
     ],
   });
   ```

2. **View Logs:**
   - https://console.cloud.google.com/logs
   - Filter: `resource.type="cloud_run_revision" AND resource.labels.service_name="bouhmid-api"`

#### Step 5.2: Create Uptime Check

```bash
gcloud monitoring uptime-checks create bouhmid-api-health \
  --display-name="Bouhmid API Health Check" \
  --resource-type=url \
  --period=60 \
  --timeout=10s \
  --http-check-path=/health \
  --check-interval=1m \
  --monitored-resource=https://bouhmid-api-XXX-uc.a.run.app
```

#### Step 5.3: Free Error Tracking with Sentry

```bash
# Sign up at https://sentry.io (free tier: 5K events/month)
# Add to API:
npm install @sentry/node @sentry/profiling-node

# backend/api/src/server.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions (cost control)
});

app.addHook('onError', (request, reply, error, done) => {
  Sentry.captureException(error);
  done();
});
```

#### Step 5.4: Simple Email Alerts (Free via SMTP)

```typescript
// backend/api/src/lib/alerts.ts
import nodemailer from 'nodemailer';

export async function sendCriticalAlert(message: string) {
  if (process.env.ALERT_EMAIL) {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_APP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ALERT_EMAIL,
      subject: '[CRITICAL] Bouhmid API Alert',
      text: message,
    });
  }
}
```

---

### Phase 6: Cost Control Measures (Day 4)

#### Step 6.1: Set Budget Alerts

```bash
# Create budget
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT_ID \
  --display-name="Bouhmid $300 Monthly Limit" \
  --budget-amount=300USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=75 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

#### Step 6.2: Configure Resource Quotas

```bash
# Limit max Cloud Run instances (already set to 5)
# Add resource quotas in GCP Console:
# - Max 5 Cloud Run instances
# - Max 1 Cloud Run service
# - Budget cap at $300
```

#### Step 6.3: Enable Cost Breakdown

- Navigate to: https://console.cloud.google.com/billing/reports
- Enable: Cost breakdown by service
- Set alerts: Daily email if cost > $10/day

---

## 6. COST-CONTROL POLICY FOR AGENTS

### Manual Trigger Architecture

Since agents are DISABLED for MVP, here's the plan for Phase 2 reactivation:

#### Prospector Agent - Manual Mode

**Before Re-enabling:**
- Revenue > $500/month
- Admin approval required
- Google Places API budget set to $50/month max

**Manual Triggers (NO scheduled jobs):**

1. **Lead Discovery (Manual):**
   ```typescript
   // New admin endpoint: POST /api/admin/prospector/discover-leads
   app.post('/api/admin/prospector/discover-leads', async (req, reply) => {
     const { city, maxResults = 10 } = req.body;

     // Limit to prevent cost explosion
     if (maxResults > 20) {
       throw new Error('Max 20 results per manual search');
     }

     // Call Prospector API
     const response = await fetch('http://prospector:8001/api/discover', {
       method: 'POST',
       body: JSON.stringify({ city, max_results: maxResults }),
     });

     return response.json();
   });
   ```

2. **Website Scraping (Manual):**
   ```typescript
   // POST /api/admin/prospector/scrape-lead/:leadId
   app.post('/api/admin/prospector/scrape-lead/:leadId', async (req, reply) => {
     const { leadId } = req.params;

     // Trigger single lead scrape
     await fetch(`http://prospector:8001/api/leads/${leadId}/scrape`, {
       method: 'POST',
     });

     return { status: 'scraping_started' };
   });
   ```

3. **Batch Operations (Limited):**
   ```typescript
   // POST /api/admin/prospector/batch-scrape
   app.post('/api/admin/prospector/batch-scrape', async (req, reply) => {
     const { leadIds } = req.body;

     // Hard limit: 10 leads per batch
     if (leadIds.length > 10) {
       throw new Error('Max 10 leads per batch operation');
     }

     // Process in background (Cloud Run job)
     await triggerCloudRunJob('prospector-batch', { lead_ids: leadIds });

     return { status: 'batch_queued', count: leadIds.length };
   });
   ```

#### Orion Agent - Simplified Mode

**Before Re-enabling:**
- Revenue > $1,000/month
- At least 100 products with 90+ days sales history

**Manual Triggers:**

1. **On-Demand Forecasting:**
   ```typescript
   // POST /api/admin/orion/forecast/:productId
   app.post('/api/admin/orion/forecast/:productId', async (req, reply) => {
     const { productId } = req.params;

     // Single product forecast
     const forecast = await fetch(`http://orion:8002/api/forecast/${productId}`, {
       method: 'POST',
       body: JSON.stringify({ days: 30 }),
     });

     return forecast.json();
   });
   ```

2. **Weekly Batch (Manual Trigger):**
   ```typescript
   // POST /api/admin/orion/generate-all-forecasts
   app.post('/api/admin/orion/generate-all-forecasts', async (req, reply) => {
     // Admin manually triggers weekly forecast generation
     await triggerCloudRunJob('orion-forecasts', { mode: 'all' });

     return { status: 'forecast_generation_started' };
   });
   ```

### Cost Control Limits

#### Google Places API Limits (Phase 2)

```env
# Prospector environment variables
GOOGLE_PLACES_DAILY_QUOTA=100        # Max 100 searches/day = $3.20/day
GOOGLE_PLACES_MONTHLY_BUDGET=50      # Alert at $50/month
GOOGLE_PLACES_ENABLE_QUOTAS=true     # Enforce hard limits
```

**Implementation:**
```python
# backend/agents/prospector/app/services/google_places.py
import redis
from datetime import datetime, timedelta

class GooglePlacesService:
    def __init__(self):
        self.redis = redis.Redis(host='upstash-url')
        self.daily_quota = int(os.getenv('GOOGLE_PLACES_DAILY_QUOTA', 100))

    async def search_places(self, query: str, city: str):
        # Check daily quota
        today = datetime.now().strftime('%Y-%m-%d')
        key = f"gplaces:quota:{today}"

        current_count = self.redis.get(key)
        if current_count and int(current_count) >= self.daily_quota:
            raise QuotaExceededException(
                f"Daily quota of {self.daily_quota} searches exceeded. Try again tomorrow."
            )

        # Increment counter
        self.redis.incr(key)
        self.redis.expire(key, timedelta(days=2))

        # Proceed with API call
        return await self._call_google_places_api(query, city)
```

#### Compute Limits (Cloud Run)

```yaml
# Cloud Run Configuration
minInstances: 0          # Scale to zero when idle
maxInstances: 3          # Hard cap (was 5 in main API)
cpu: 1                   # 1 vCPU
memory: 512Mi            # 512 MB RAM
timeout: 300s            # 5 min max (for ML jobs)
concurrency: 10          # Lower for agent workloads

# Cost per instance-hour: ~$0.024
# Max cost per day (24h × 3 instances): $1.73/day = $52/month
```

#### ML Model Training Limits

```python
# backend/agents/orion/app/services/forecasting.py

MAX_PRODUCTS_PER_RUN = 50           # Train max 50 products at once
MODEL_TRAINING_COOLDOWN_HOURS = 168  # Once per week only
ENABLE_AUTO_RETRAINING = False       # Manual trigger only
```

### Monitoring Dashboard (Free Tier)

Use Cloud Monitoring (free tier) with custom metrics:

```typescript
// backend/api/src/lib/metrics.ts
import { MetricServiceClient } from '@google-cloud/monitoring';

const metricsClient = new MetricServiceClient();

export async function recordAgentCall(agentName: string, cost: number) {
  const dataPoint = {
    interval: {
      endTime: { seconds: Date.now() / 1000 },
    },
    value: { doubleValue: cost },
  };

  await metricsClient.createTimeSeries({
    name: `projects/bouhmid-mvp`,
    timeSeries: [
      {
        metric: {
          type: 'custom.googleapis.com/agent/cost',
          labels: { agent: agentName },
        },
        resource: {
          type: 'global',
        },
        points: [dataPoint],
      },
    ],
  });
}
```

### Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| **Daily Google Places API calls** | 80 | 100 | Disable API |
| **Daily compute cost** | $8 | $10 | Scale down |
| **Monthly total cost** | $225 | $280 | Freeze deployments |
| **Cloud Run instance hours** | 500h | 700h | Reduce max instances |
| **API error rate** | 5% | 10% | Investigate |

### Emergency Kill Switch

```bash
# Create emergency script: scripts/emergency-shutdown.sh
#!/bin/bash

echo "🚨 EMERGENCY COST SHUTDOWN"

# Scale down all services
gcloud run services update bouhmid-api --region us-central1 --max-instances 1 --min-instances 0
gcloud run services update prospector --region us-central1 --max-instances 0 --min-instances 0 --no-allow-unauthenticated
gcloud run services update orion --region us-central1 --max-instances 0 --min-instances 0 --no-allow-unauthenticated

echo "✅ All services scaled down. Only main API running at minimum."
```

---

## 7. ESTIMATED MONTHLY COSTS

### MVP (Month 1-3)

| Service | Details | Cost |
|---------|---------|------|
| **Firebase Hosting** | Static frontend + CDN | $0 |
| **Cloud Run (API)** | 512 MB, ~100 requests/day, scale-to-zero | $5-15 |
| **Supabase** | Free tier (500 MB database) | $0 |
| **Cloud Logging** | 50 GB/month free tier | $0 |
| **Cloud Monitoring** | Free tier metrics | $0 |
| **Cloud Build** | 120 builds/day free | $0 |
| **Sentry** | 5K events/month free | $0 |
| **SMTP (Gmail)** | Email alerts | $0 |
| **Custom Domain** | (Optional) | $12/year |
| **TOTAL** | | **$5-15/month** ✅ |

**Remaining budget:** $285-295/month for growth

---

### Phase 2 (Month 4-6) - Growth

| Service | Details | Cost |
|---------|---------|------|
| **Firebase Hosting** | Static frontend | $0 |
| **Cloud Run (API)** | 512 MB, ~1,000 requests/day | $15-30 |
| **Supabase Pro** | 8 GB database, upgraded | $25 |
| **Upstash Redis** | Serverless cache, 1M commands/month | $10 |
| **Cloud Logging** | ~100 GB/month | $5 |
| **Sentry** | 5K events/month free | $0 |
| **TOTAL** | | **$55-70/month** ✅ |

**Remaining budget:** $230-245/month for agents

---

### Phase 3 (Month 7+) - Agents Enabled

| Service | Details | Cost |
|---------|---------|------|
| **Firebase Hosting** | Static frontend | $0 |
| **Cloud Run (API)** | 1 GB, ~5,000 requests/day | $30-50 |
| **Cloud Run (Prospector)** | Manual triggers only, ~10h/month | $5-10 |
| **Cloud Run (Orion)** | Manual forecasts, ~20h/month | $10-20 |
| **Supabase Pro** | 8 GB database | $25 |
| **Upstash Redis** | Task queue + cache | $15-20 |
| **Google Places API** | 100 searches/day × $0.032 = $3.20/day | $96 |
| **Cloud Logging** | ~200 GB/month | $10 |
| **Cloud Storage** | Backups, exports | $5 |
| **TOTAL** | | **$196-236/month** ✅ |

**Buffer:** $64-104/month for spikes

---

## 8. DEPLOYMENT CHECKLIST

### Pre-Deployment

- [ ] Create GCP project
- [ ] Enable billing (with $300 limit)
- [ ] Create Supabase account and project
- [ ] Create Firebase project
- [ ] Set up budget alerts ($150, $225, $280)
- [ ] Generate all secrets (JWT, passwords)
- [ ] Prepare production environment variables

### Database Setup

- [ ] Run Prisma migrations on Supabase
- [ ] Seed initial data (brands, categories)
- [ ] Create admin user
- [ ] Enable Row Level Security
- [ ] Configure daily backups
- [ ] Test database connection

### API Deployment

- [ ] Build production Docker image
- [ ] Store secrets in Secret Manager
- [ ] Deploy to Cloud Run (min: 0, max: 5)
- [ ] Configure environment variables
- [ ] Test health endpoint
- [ ] Test API endpoints (products, auth)
- [ ] Verify database connectivity
- [ ] Check Cloud Logging

### Frontend Deployment

- [ ] Update API base URL in env
- [ ] Build production bundle
- [ ] Initialize Firebase Hosting
- [ ] Deploy to Firebase
- [ ] Test all pages
- [ ] Verify API calls work
- [ ] Check CORS settings
- [ ] Test on mobile

### CI/CD Setup

- [ ] Create GCP service account
- [ ] Generate service account key
- [ ] Add GitHub secrets
- [ ] Configure GitHub Actions workflows
- [ ] Test deployment pipeline
- [ ] Enable branch protection

### Monitoring

- [ ] Enable Cloud Logging
- [ ] Create uptime checks
- [ ] Set up Sentry error tracking
- [ ] Configure email alerts
- [ ] Test alerting (force error)
- [ ] Create monitoring dashboard

### Security

- [ ] Review CORS settings
- [ ] Enable rate limiting
- [ ] Configure JWT expiration
- [ ] Test authentication flows
- [ ] Review IAM permissions
- [ ] Enable HTTPS only
- [ ] Set security headers

### Cost Control

- [ ] Set budget alerts (50%, 75%, 90%, 100%)
- [ ] Configure max instances (5)
- [ ] Disable unused APIs
- [ ] Set up cost breakdown reports
- [ ] Create emergency shutdown script
- [ ] Document manual triggers
- [ ] Test scale-to-zero

### Documentation

- [ ] Document deployment process
- [ ] Create runbook for common issues
- [ ] Document environment variables
- [ ] Create admin user guide
- [ ] Document manual agent triggers
- [ ] Create cost monitoring guide

---

## 9. FUTURE OPTIMIZATION OPPORTUNITIES

### Month 6+ (When Revenue Justifies)

1. **Custom Domain + CDN:**
   - Cloudflare Free Tier (CDN, DDoS protection, SSL)
   - Cost: $0 (free tier)

2. **Database Read Replicas:**
   - If traffic increases significantly
   - Supabase Pro includes read replicas

3. **Advanced Caching:**
   - Redis caching layer (Upstash)
   - API response caching
   - Cost: $10-20/month

4. **Scheduled Tasks (Cloud Scheduler):**
   - Instead of always-on Celery Beat
   - $0.10/job/month
   - Run Prospector daily = $3/month

5. **Cloud Run Jobs (vs Services):**
   - For batch operations (forecasting, scraping)
   - Only pay for execution time
   - More cost-effective than always-available services

6. **Image Optimization:**
   - Cloud CDN for product images
   - Image compression (TinyPNG API)
   - Cost: Minimal (~$5-10/month)

---

## 10. ROLLBACK PLAN

If costs exceed budget:

### Emergency Actions (Same Day)

1. **Scale down immediately:**
   ```bash
   gcloud run services update bouhmid-api --max-instances 2
   ```

2. **Disable agents:**
   ```bash
   gcloud run services update prospector --no-allow-unauthenticated
   gcloud run services update orion --no-allow-unauthenticated
   ```

3. **Check cost breakdown:**
   - https://console.cloud.google.com/billing/reports

4. **Identify culprit:**
   - API calls spiking?
   - Agent running wild?
   - Database queries inefficient?

### Recovery Steps

1. **Fix the issue:**
   - Add rate limiting
   - Optimize queries
   - Fix infinite loops

2. **Re-enable gradually:**
   - Start with API only
   - Monitor for 24h
   - Add agents one by one

3. **Post-mortem:**
   - Document what happened
   - Update limits
   - Improve monitoring

---

## 11. SUCCESS METRICS

### Month 1 Goals

- [ ] MVP deployed and accessible
- [ ] Admin can log in
- [ ] Products display correctly
- [ ] Search/filter works
- [ ] Cost < $20/month
- [ ] 99% uptime

### Month 3 Goals

- [ ] 100+ products in catalog
- [ ] 10+ daily visitors
- [ ] Cost < $30/month
- [ ] Admin actively using platform
- [ ] No critical errors

### Month 6 Goals

- [ ] 500+ products
- [ ] 50+ daily visitors
- [ ] Redis caching enabled
- [ ] Cost < $100/month
- [ ] Ready for Phase 3 (agents)

---

## 12. SUPPORT & RESOURCES

### Documentation
- GCP Cloud Run: https://cloud.google.com/run/docs
- Supabase: https://supabase.com/docs
- Firebase Hosting: https://firebase.google.com/docs/hosting

### Cost Calculators
- GCP Pricing Calculator: https://cloud.google.com/products/calculator
- Supabase Pricing: https://supabase.com/pricing

### Community
- GCP Free Tier: https://cloud.google.com/free
- r/googlecloud
- Supabase Discord

---

## SUMMARY

✅ **MVP Deployment:** $5-15/month (well under budget)
✅ **Essential Features:** Product catalog + admin panel
✅ **Scale-to-Zero:** Cloud Run scales down when idle
✅ **Free Database:** Supabase free tier (500 MB)
✅ **Free Frontend:** Firebase Hosting
✅ **Agents:** Disabled until revenue justifies ($500+/month)
✅ **Monitoring:** Cloud Logging + Sentry free tiers
✅ **Safety:** Budget alerts + emergency shutdown

**You're ready to deploy! 🚀**
