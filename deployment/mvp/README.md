# Bouhmid MVP Deployment Guide

This directory contains all scripts and configurations for deploying the Bouhmid MVP to GCP within a $300/month budget.

## Quick Start

### 1. Prerequisites

```bash
# Install gcloud CLI
# https://cloud.google.com/sdk/docs/install

# Login
gcloud auth login

# Set project
gcloud config set project bouhmid-mvp
```

### 2. Initial Setup

```bash
cd deployment/mvp

# 1. Configure environment variables
cp .env.production.template .env.production
# Edit .env.production with your actual values

# 2. Create GCP secrets
chmod +x setup-secrets.sh
./setup-secrets.sh

# 3. Setup budget alerts
chmod +x setup-budget-alerts.sh
./setup-budget-alerts.sh
```

### 3. Database Setup (Supabase)

```bash
# 1. Create Supabase project at https://supabase.com
# 2. Get connection string from project settings
# 3. Update DATABASE_URL in .env.production

# 4. Run migrations
cd ../../backend/api
export DATABASE_URL="your-supabase-connection-string"
npx prisma migrate deploy
npx prisma db seed
```

### 4. Deploy API to Cloud Run

```bash
cd ../../deployment/mvp

chmod +x deploy-to-cloudrun.sh
./deploy-to-cloudrun.sh
```

### 5. Deploy Frontend to Firebase

```bash
cd ../../frontend

# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize
firebase init hosting

# Build
npm run build

# Deploy
firebase deploy --only hosting
```

## Directory Structure

```
deployment/mvp/
├── README.md                       # This file
├── .env.production.template        # Environment variables template
├── docker-compose.mvp.yml          # Local development (minimal)
├── Dockerfile.production           # Production build for Cloud Run
├── deploy-to-cloudrun.sh          # Main deployment script
├── setup-secrets.sh               # Setup GCP Secret Manager
├── setup-budget-alerts.sh         # Configure cost alerts
├── cost-monitor.sh                # Monitor current costs
└── emergency-shutdown.sh          # Emergency cost control
```

## Scripts

### deploy-to-cloudrun.sh
Deploys the API to Cloud Run with MVP configuration (scale-to-zero, minimal resources).

```bash
./deploy-to-cloudrun.sh
```

### setup-secrets.sh
Creates or updates secrets in GCP Secret Manager from .env.production.

```bash
./setup-secrets.sh
```

### setup-budget-alerts.sh
Configures budget alerts at 50%, 75%, 90%, and 100% of $300 monthly budget.

```bash
./setup-budget-alerts.sh
```

### cost-monitor.sh
Displays current costs, resource usage, and optimization recommendations.

```bash
./cost-monitor.sh
```

### emergency-shutdown.sh
Immediately scales down all services to minimum to prevent cost explosion.

```bash
./emergency-shutdown.sh
```

## MVP Configuration

### What's Deployed
- ✅ Main API (Cloud Run, scale-to-zero)
- ✅ Frontend (Firebase Hosting, FREE)
- ✅ PostgreSQL (Supabase, FREE tier)

### What's Disabled
- ❌ Prospector Agent (Google Places API too expensive)
- ❌ Orion Agent (ML forecasting not needed yet)
- ❌ Redis (low traffic, cache not critical)
- ❌ Monitoring stack (using GCP built-in tools)
- ❌ Scheduled workers (no automated tasks)

## Cost Breakdown

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| Firebase Hosting | Static files + CDN | $0 |
| Cloud Run API | 512MB, scale-to-zero, ~100 req/day | $5-15 |
| Supabase | Free tier (500 MB) | $0 |
| Cloud Logging | 50 GB/month free tier | $0 |
| Cloud Build | CI/CD (120 builds/day free) | $0 |
| **TOTAL** | | **$5-15/month** |

**Remaining budget:** $285-295/month for future growth

## Environment Variables

Required secrets (stored in GCP Secret Manager):
- `DATABASE_URL` - Supabase PostgreSQL connection string
- `JWT_SECRET` - 32+ character secret for JWT signing
- `JWT_REFRESH_SECRET` - 32+ character secret for refresh tokens

Public environment variables (set in Cloud Run):
- `NODE_ENV=production`
- `PORT=8080`
- `CORS_ORIGIN` - Frontend URL
- `FRONTEND_URL` - Frontend URL
- `LOG_LEVEL=info`
- `REDIS_ENABLED=false`

## Monitoring

### Built-in (Free)
- **Cloud Run Metrics**: https://console.cloud.google.com/run
- **Cloud Logging**: https://console.cloud.google.com/logs
- **Uptime Checks**: https://console.cloud.google.com/monitoring/uptime
- **Cost Reports**: https://console.cloud.google.com/billing/reports

### Optional (Free Tier)
- **Sentry**: 5K events/month - https://sentry.io
- **Email Alerts**: Via SMTP (Gmail app passwords)

## Troubleshooting

### Deployment fails with "Permission denied"
```bash
# Grant Cloud Run permissions
gcloud projects add-iam-policy-binding bouhmid-mvp \
  --member="serviceAccount:YOUR-PROJECT-NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/run.admin"
```

### Database connection fails
1. Check DATABASE_URL secret is correct
2. Verify Supabase project is active
3. Check IP allowlist in Supabase (should allow all)
4. Test connection: `psql $DATABASE_URL`

### High costs
```bash
# Check current costs
./cost-monitor.sh

# Emergency shutdown if needed
./emergency-shutdown.sh

# View detailed billing
# https://console.cloud.google.com/billing/reports
```

### Cold starts taking too long
- Expected: 2-3 seconds (acceptable for MVP)
- To reduce: Consider min-instances=1 (adds ~$15/month)
- Future: Move to Cloud Run v2 with startup CPU boost

## CI/CD

GitHub Actions workflows are configured for automatic deployment:
- `.github/workflows/deploy-api.yml` - Deploys API on push to main
- `.github/workflows/deploy-frontend.yml` - Deploys frontend on push to main

Required GitHub Secrets:
- `GCP_SA_KEY` - Service account JSON key
- `FIREBASE_SERVICE_ACCOUNT` - Firebase service account key

## Security Checklist

- [ ] JWT secrets are 32+ characters
- [ ] Database URL is stored in Secret Manager (not env vars)
- [ ] CORS is configured correctly
- [ ] Rate limiting is enabled
- [ ] Cloud Run uses non-root user
- [ ] Budget alerts are configured
- [ ] Secrets are not in git

## Next Steps (Phase 2)

When revenue > $500/month:
1. Add Redis caching (Upstash serverless)
2. Enable customer authentication
3. Add email notifications
4. Upgrade Supabase to Pro ($25/month)

When revenue > $1,000/month:
1. Enable Prospector Agent (with API quotas)
2. Enable basic demand forecasting
3. Add scheduled tasks (Cloud Scheduler)

## Support

For questions or issues:
- Documentation: `/docs/GCP_COST_OPTIMIZED_DEPLOYMENT.md`
- GCP Support: https://cloud.google.com/support
- Supabase Docs: https://supabase.com/docs

## License

Proprietary - Bouhmid Project
