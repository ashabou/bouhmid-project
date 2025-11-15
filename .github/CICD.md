# CI/CD Pipeline Documentation

Automated testing, building, and deployment for Shabou Auto Pièces.

## Overview

Our CI/CD pipeline uses GitHub Actions to automate:
- **Testing** on every PR and push
- **Building** Docker images on merge to main
- **Deploying** to staging automatically
- **Deploying** to production on version tags

---

## Workflows

### 1. CI Workflow (`ci.yml`)

**Triggers:**
- Pull requests to `main` or `develop`
- Pushes to `main` or `develop`

**Jobs:**

| Job | Description | Duration |
|-----|-------------|----------|
| `test-api` | Test Node.js API with Jest | ~3-5 min |
| `test-prospector` | Test Prospector agent with pytest | ~4-6 min |
| `test-orion` | Test Orion agent with pytest | ~5-8 min |
| `security-scan` | Run Trivy security scanner | ~2-3 min |
| `build-check` | Verify Docker builds work | ~5-7 min |

**Total Duration**: ~20-30 minutes (jobs run in parallel)

**Services Used**:
- PostgreSQL 15 (for tests)
- Redis 7 (for tests)

**Code Coverage**:
- Uploaded to Codecov
- Minimum 80% coverage required

### 2. CD Workflow (`cd.yml`)

**Triggers:**
- Push to `main` → Deploy to staging
- Push tag `v*.*.*` → Deploy to production
- Manual workflow dispatch

**Jobs:**

| Job | Description | Duration |
|-----|-------------|----------|
| `build-and-push` | Build and push Docker images | ~10-15 min |
| `deploy-staging` | Deploy to staging server | ~5-8 min |
| `deploy-production` | Deploy to production server | ~8-12 min |

**Deployment Strategy**:
- **Staging**: Automatic on every merge to main
- **Production**: Automatic on version tags OR manual approval

---

## Setup Instructions

### 1. Configure GitHub Secrets

Go to: **Repository Settings → Secrets and variables → Actions**

Add the following secrets:

#### Required Secrets

| Secret | Description | Example |
|--------|-------------|---------|
| `STAGING_HOST` | Staging server hostname/IP | `staging.example.com` |
| `STAGING_USER` | SSH username | `deploy` |
| `STAGING_SSH_PRIVATE_KEY` | SSH private key | `-----BEGIN RSA PRIVATE KEY-----...` |
| `PRODUCTION_HOST` | Production server hostname/IP | `api.example.com` |
| `PRODUCTION_USER` | SSH username | `deploy` |
| `PRODUCTION_SSH_PRIVATE_KEY` | SSH private key | `-----BEGIN RSA PRIVATE KEY-----...` |

#### Optional Secrets

| Secret | Description |
|--------|-------------|
| `SLACK_WEBHOOK` | Slack webhook for notifications |
| `CODECOV_TOKEN` | Codecov token for coverage reports |

**Note**: `GITHUB_TOKEN` is automatically provided by GitHub Actions.

### 2. Generate SSH Keys

On your local machine:

```bash
# Generate SSH key pair for staging
ssh-keygen -t rsa -b 4096 -C "github-actions-staging" -f ~/.ssh/github_actions_staging

# Generate SSH key pair for production
ssh-keygen -t rsa -b 4096 -C "github-actions-production" -f ~/.ssh/github_actions_production

# Copy public keys to servers
ssh-copy-id -i ~/.ssh/github_actions_staging.pub deploy@staging.example.com
ssh-copy-id -i ~/.ssh/github_actions_production.pub deploy@api.example.com

# Copy private keys to GitHub secrets
cat ~/.ssh/github_actions_staging
cat ~/.ssh/github_actions_production
```

### 3. Configure Docker Registry

The pipeline uses GitHub Container Registry (ghcr.io) by default.

**Images pushed:**
- `ghcr.io/YOUR_USERNAME/shabou-api:latest`
- `ghcr.io/YOUR_USERNAME/shabou-prospector:latest`
- `ghcr.io/YOUR_USERNAME/shabou-orion:latest`

**Tagging Strategy:**
- `latest` - Latest build from main branch
- `v1.0.0` - Semantic version tags
- `v1.0` - Major.minor tags
- `v1` - Major version tags
- `main-abc123` - Branch name + commit SHA

### 4. Setup Server Access

On each server (staging and production):

```bash
# Create deploy user
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG docker deploy

# Create application directory
sudo mkdir -p /opt/shabou-autopieces
sudo chown deploy:deploy /opt/shabou-autopieces

# Create backups directory
sudo mkdir -p /backups
sudo chown deploy:deploy /backups

# Switch to deploy user
su - deploy

# Clone repository
cd /opt/shabou-autopieces
git clone https://github.com/YOUR_USERNAME/bouhmid-project.git .

# Configure environment
cd backend
cp .env.example .env
vim .env  # Edit with production values

# Test deployment manually first
docker-compose up -d
```

---

## Usage

### Deploy to Staging

**Automatic** (recommended):
```bash
# Merge PR to main
git checkout main
git pull
git merge your-feature-branch
git push origin main

# GitHub Actions will automatically:
# 1. Run tests
# 2. Build images
# 3. Deploy to staging
# 4. Run health checks
```

**Manual**:
```bash
# Via GitHub UI
1. Go to Actions tab
2. Select "CD - Build & Deploy"
3. Click "Run workflow"
4. Select "staging" environment
5. Click "Run workflow"
```

### Deploy to Production

**Recommended** (version tags):
```bash
# Create and push version tag
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions will:
# 1. Build images with version tags
# 2. Deploy to production (with approval if configured)
# 3. Create GitHub release
```

**Manual**:
```bash
# Via GitHub UI
1. Go to Actions tab
2. Select "CD - Build & Deploy"
3. Click "Run workflow"
4. Select "production" environment
5. Click "Run workflow"
6. Approve deployment (if protection rules enabled)
```

---

## Deployment Flow

### Staging Deployment

```
┌─────────────────┐
│   Push to main  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Run tests     │
│  (CI workflow)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Build images   │
│  Push to GHCR   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  SSH to staging │
│  Pull images    │
│  Run migrations │
│  Restart services│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Health checks  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│Success │ │  Failed  │
│        │ │ Rollback │
└────────┘ └──────────┘
```

### Production Deployment

```
┌─────────────────┐
│  Push tag v1.0.0│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Build images   │
│  Tag: v1.0.0    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│Create DB backup │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Deploy with     │
│ zero downtime   │
│ (rolling update)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Health checks  │
│  Smoke tests    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│Success │ │  Failed  │
│Create  │ │ Rollback │
│Release │ │ & Restore│
└────────┘ └──────────┘
```

---

## Environment Protection

### Recommended GitHub Environment Settings

**Staging Environment:**
- No protection rules (auto-deploy on merge)
- Environment secrets: `STAGING_*`

**Production Environment:**
- ✅ Required reviewers: 1-2 people
- ✅ Wait timer: 5 minutes
- ✅ Deployment branches: `main` + tags only
- Environment secrets: `PRODUCTION_*`

Configure at: **Settings → Environments → New environment**

---

## Monitoring Deployments

### View Workflow Runs

1. Go to **Actions** tab
2. Click on a workflow run
3. View logs for each job
4. Download artifacts if needed

### Deployment Notifications

If Slack webhook is configured, you'll receive notifications for:
- ✅ Successful deployments
- ❌ Failed deployments
- 🔄 Rollbacks

### Check Deployment Status

```bash
# Via health check script
./scripts/health-check.sh staging
./scripts/health-check.sh production

# Via curl
curl https://staging-api.shabouautopieces.tn/api/v1/health
curl https://api.shabouautopieces.tn/api/v1/health

# Check deployed version
curl https://api.shabouautopieces.tn/api/v1/version
```

---

## Troubleshooting

### Build Fails

**Symptom**: Build job fails in CI

**Solutions**:
1. Check build logs in GitHub Actions
2. Test build locally:
   ```bash
   docker build -f backend/api/Dockerfile backend/api
   ```
3. Check Dockerfile syntax
4. Verify dependencies in package.json/requirements.txt

### Tests Fail

**Symptom**: Test job fails in CI

**Solutions**:
1. Run tests locally:
   ```bash
   cd backend/api
   npm test
   ```
2. Check if tests pass with same Node/Python version as CI
3. Verify test database migrations
4. Check environment variables in workflow

### Deployment Fails

**Symptom**: Deploy job fails

**Solutions**:
1. Check GitHub Actions logs
2. Verify SSH connection:
   ```bash
   ssh deploy@staging.example.com
   ```
3. Check server disk space:
   ```bash
   ssh deploy@staging.example.com "df -h"
   ```
4. Manually pull images:
   ```bash
   ssh deploy@staging.example.com "cd /opt/shabou-autopieces/backend && docker-compose pull"
   ```

### Health Checks Fail After Deployment

**Symptom**: Deployment succeeds but health checks fail

**Solutions**:
1. Check service logs:
   ```bash
   ssh deploy@staging.example.com "cd /opt/shabou-autopieces/backend && docker-compose logs"
   ```
2. Verify services are running:
   ```bash
   ssh deploy@staging.example.com "cd /opt/shabou-autopieces/backend && docker-compose ps"
   ```
3. Check database migrations:
   ```bash
   ssh deploy@staging.example.com "cd /opt/shabou-autopieces/backend && docker-compose exec api npm run db:migrate:status"
   ```
4. Rollback if needed:
   ```bash
   ./scripts/rollback.sh staging
   ```

### Cannot Push to GitHub Container Registry

**Symptom**: `docker login` fails in CD workflow

**Solutions**:
1. Verify `GITHUB_TOKEN` permissions
2. Check repository settings → Actions → General → Workflow permissions
3. Ensure "Read and write permissions" is enabled

---

## Best Practices

### Version Tagging

Use semantic versioning:
- **v1.0.0**: Major.Minor.Patch
- **v1.0.0-beta.1**: Pre-release versions
- **v1.0.0-rc.1**: Release candidates

```bash
# Regular release
git tag v1.2.3
git push origin v1.2.3

# Pre-release
git tag v2.0.0-beta.1
git push origin v2.0.0-beta.1
```

### Deployment Schedule

**Recommended**:
- **Staging**: Continuous (on every merge)
- **Production**: During low-traffic hours
  - Weekdays: 2-4 AM local time
  - Avoid Fridays and weekends

### Rollback Strategy

**Always**:
1. Create backup before deployment (automated)
2. Test in staging first
3. Have rollback plan ready
4. Monitor for 30 minutes post-deployment
5. Keep last 3 versions available for quick rollback

### Testing Before Merge

```bash
# Run tests locally
cd backend/api && npm test
cd backend/agents/prospector && pytest
cd backend/agents/orion && pytest

# Build Docker images
docker build -f backend/api/Dockerfile backend/api

# Test with docker-compose
cd backend && docker-compose up -d
./scripts/health-check.sh local
```

---

## Performance Optimization

### Cache Docker Layers

Already configured in workflows:
```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

### Parallel Jobs

Tests run in parallel by default (API, Prospector, Orion).

### Reduce Build Time

1. Use multi-stage Dockerfiles (already implemented)
2. Cache npm/pip dependencies
3. Use GitHub Actions cache
4. Build only changed services (advanced)

---

## Security

### Secrets Management

- ✅ All secrets in GitHub Secrets (encrypted)
- ✅ Never commit secrets to git
- ✅ Rotate SSH keys every 90 days
- ✅ Use read-only tokens where possible

### Image Scanning

Trivy security scanner runs on every PR:
- Scans for vulnerabilities
- Fails if HIGH or CRITICAL found
- Results uploaded to GitHub Security

### Access Control

- Limit who can trigger production deployments
- Use environment protection rules
- Require code reviews before merge
- Enable branch protection on `main`

---

**Documentation Version:** 1.0
**Last Updated:** 2025-11-15
