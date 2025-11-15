# Backend Refactor Migration Guide

This guide provides step-by-step instructions for migrating from the current backend structure to the refactored architecture using the shared library.

## Overview

**Goals:**
1. Eliminate code duplication between Orion and Prospector agents
2. Improve maintainability with shared utilities
3. Add cost protection mechanisms
4. Fix security issues (CORS, secrets)
5. Standardize configuration management

**Estimated Migration Time:** 4-6 hours

---

## Pre-Migration Checklist

- [ ] **Backup current code**
  ```bash
  git checkout -b backup/before-refactor
  git commit -am "Backup before refactor"
  git push origin backup/before-refactor
  ```

- [ ] **Create migration branch**
  ```bash
  git checkout -b refactor/backend-shared-library
  ```

- [ ] **Verify all services are running**
  ```bash
  docker-compose ps
  # All services should be "Up"
  ```

- [ ] **Run existing tests**
  ```bash
  cd backend/agents/orion
  pytest
  # Note pass/fail rate for comparison after migration
  ```

- [ ] **Export environment variables**
  ```bash
  cp backend/.env backend/.env.backup
  ```

---

## Migration Steps

### Phase 1: Setup Shared Library (30 minutes)

#### Step 1.1: Verify shared library is created

```bash
cd backend/shared
ls -la

# Should see:
# __init__.py
# README.md
# requirements.txt
# database/
# celery/
# config/
# utils/
```

#### Step 1.2: Install shared library in agents

**For Orion:**
```bash
cd backend/agents/orion

# Add shared library to PYTHONPATH in Dockerfile
# Edit Dockerfile and add:
ENV PYTHONPATH="${PYTHONPATH}:/app/../../shared"

# Update requirements.txt
echo "# Shared library (local)" >> requirements.txt
echo "-e ../../shared" >> requirements.txt
```

**For Prospector:**
```bash
cd backend/agents/prospector

# Same changes as Orion
ENV PYTHONPATH="${PYTHONPATH}:/app/../../shared"

echo "# Shared library (local)" >> requirements.txt
echo "-e ../../shared" >> requirements.txt
```

#### Step 1.3: Update .dockerignore

```bash
cd backend

# Ensure .dockerignore doesn't exclude shared/
# Remove any lines that would exclude ../shared
```

---

### Phase 2: Migrate Orion Agent (1.5 hours)

#### Step 2.1: Backup current files

```bash
cd backend/agents/orion/app

cp config.py config.py.backup
cp models/database.py models/database.py.backup
cp scheduler/celery_app.py scheduler/celery_app.py.backup
```

#### Step 2.2: Update config.py

```bash
# Replace config.py with refactored version
cp config_refactored.py.example config.py
```

**Manual changes needed:**
1. Remove duplicate fields (DATABASE_URL, REDIS_URL, CELERY, LOG_LEVEL, SMTP)
2. Keep only Orion-specific settings
3. Update imports: `from shared.config import BaseSettings`

**Test:**
```python
python -c "from app.config import settings; print(settings.DATABASE_URL)"
# Should print database URL without errors
```

#### Step 2.3: Update database.py

```bash
# Replace app/models/database.py
```

**Old code:**
```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

engine = create_engine(settings.DATABASE_URL, pool_size=10, max_overflow=20)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
```

**New code:**
```python
from shared.database import create_database_engine, get_session_factory, Base
from ..config import settings

engine = create_database_engine(
    database_url=settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20
)
SessionLocal = get_session_factory(engine)

# Base is now imported from shared
# Remove: Base = declarative_base()
```

**Update model imports:**
```bash
# In app/models/forecast.py, sales_history.py, etc.
# Change: from .database import Base
# To:     from shared.database import Base
```

#### Step 2.4: Update celery_app.py

```bash
cp scheduler/celery_app_refactored.py.example scheduler/celery_app.py
```

**Key changes:**
- Import `create_celery_app` from shared
- Remove duplicate config (task_serializer, timezone, etc.)
- Keep only beat_schedule and Orion-specific settings

**Test:**
```bash
celery -A app.scheduler.celery_app worker --loglevel=debug
# Should start without errors
```

#### Step 2.5: Add cost protection (if needed)

```python
# In app/scheduler/tasks.py

from shared.utils import CostProtector
import redis

# Initialize cost protector
redis_client = redis.from_url(settings.CELERY_BROKER_URL)
cost_protector = CostProtector(redis_client=redis_client)

# Register forecast generation limits
cost_protector.register_api(
    service_name="forecast_generation",
    daily_limit=settings.MAX_FORECASTS_PER_DAY,
    monthly_limit=settings.MAX_FORECASTS_PER_DAY * 30
)

@celery_app.task
def generate_all_forecasts():
    # Check cost limits before running
    if not cost_protector.can_use_api("forecast_generation"):
        logger.error("Daily forecast limit reached - aborting")
        return {"status": "aborted", "reason": "daily_limit"}

    # ... existing forecast generation code ...

    cost_protector.record_api_call("forecast_generation", count=forecasts_generated)
```

#### Step 2.6: Run Orion tests

```bash
cd backend/agents/orion
pytest

# All tests should pass
# Compare results with pre-migration test run
```

---

### Phase 3: Migrate Prospector Agent (1.5 hours)

#### Step 3.1: Backup current files

```bash
cd backend/agents/prospector/app

cp config.py config.py.backup
cp models/database.py models/database.py.backup
cp scheduler/celery_app.py scheduler/celery_app.py.backup
```

#### Step 3.2: Update config.py

```bash
cp config_refactored.py.example config.py
```

**Changes:**
- Remove duplicate fields
- Keep Prospector-specific settings (GOOGLE_PLACES_API_KEY, SCRAPING settings)
- **Add cost protection settings:**
  ```python
  ENABLE_COST_PROTECTION: bool = True
  GOOGLE_API_MAX_CALLS_PER_DAY: int = 150  # Stay in free tier
  GOOGLE_API_MAX_CALLS_PER_MONTH: int = 4500
  ```

#### Step 3.3: Update database.py

Same changes as Orion (see Step 2.3)

#### Step 3.4: Update celery_app.py

```bash
cp scheduler/celery_app_refactored.py.example scheduler/celery_app.py
```

**Important change:**
```python
# CHANGE: Daily scraping → Monthly scraping (cost optimization)
"monthly-google-places-scrape": {  # Was: daily-google-places-scrape
    "task": "app.scheduler.tasks.monthly_google_places_scrape",
    "schedule": crontab(day_of_month=1, hour=2, minute=0),  # Was: crontab(hour=2, minute=0)
    # ...
}
```

#### Step 3.5: Add Google Places cost protection (CRITICAL)

```python
# In app/scheduler/tasks.py

from shared.utils import CostProtector
import redis

# Initialize cost protector
redis_client = redis.from_url(settings.CELERY_BROKER_URL)
cost_protector = CostProtector(
    redis_client=redis_client,
    enabled=settings.ENABLE_COST_PROTECTION
)

# Register Google Places API
cost_protector.register_api(
    service_name="google_places",
    daily_limit=settings.GOOGLE_API_MAX_CALLS_PER_DAY,
    monthly_limit=settings.GOOGLE_API_MAX_CALLS_PER_MONTH,
    warning_threshold=0.8  # Alert at 80%
)

@celery_app.task
def monthly_google_places_scrape():  # Renamed from daily_google_places_scrape
    """
    Monthly Google Places scraping (was daily, changed to reduce costs)
    """
    # Check cost protection
    if not cost_protector.can_use_api("google_places"):
        logger.error("Google Places API budget exhausted - aborting scrape")
        # Send alert email
        send_alert_email(
            subject="Google Places Budget Exhausted",
            body="Monthly scraping aborted - API call limit reached"
        )
        return {"status": "aborted", "reason": "api_budget_exhausted"}

    # ... existing scraping code ...

    # Record API calls
    cost_protector.record_api_call("google_places", count=total_api_calls)

    logger.info(f"Scraping complete: {total_api_calls} API calls made")
```

#### Step 3.6: Update scraper to use cost protection

```python
# In app/scraper/google_places.py

from shared.utils import CostProtector

class GooglePlacesScraper:
    def __init__(self, api_key: str, cost_protector: Optional[CostProtector] = None):
        self.api_key = api_key
        self.cost_protector = cost_protector

    def search_places(self, query: str, location: str):
        # Check budget before API call
        if self.cost_protector and not self.cost_protector.can_use_api("google_places"):
            raise Exception("Google Places API budget exhausted")

        # Make API call
        result = googlemaps_client.places(query=query, location=location)

        # Record the call
        if self.cost_protector:
            self.cost_protector.record_api_call("google_places", count=1)

        return result
```

#### Step 3.7: Create Prospector tests (currently missing)

```bash
cd backend/agents/prospector

# Create tests directory
mkdir -p tests
touch tests/__init__.py

# Create basic tests
cat > tests/test_scraper.py << 'EOF'
import pytest
from app.scraper.google_places import GooglePlacesScraper

def test_scraper_initialization():
    scraper = GooglePlacesScraper(api_key="test_key")
    assert scraper.api_key == "test_key"

# TODO: Add more tests
EOF

# Run tests
pytest
```

---

### Phase 4: Update Docker Configuration (30 minutes)

#### Step 4.1: Update .env.example

```bash
cd backend

# Add new environment variables
cat >> .env.example << 'EOF'

# ========================================
# Cost Protection (NEW)
# ========================================
ENABLE_COST_PROTECTION=true
MAX_FORECASTS_PER_DAY=1000
GOOGLE_API_MAX_CALLS_PER_DAY=150
GOOGLE_API_MAX_CALLS_PER_MONTH=4500

EOF
```

#### Step 4.2: Fix CORS security issue

```bash
# Edit docker-compose.yml

# BEFORE:
# environment:
#   CORS_ORIGIN: ${CORS_ORIGIN:-*}

# AFTER:
environment:
  CORS_ORIGIN: ${CORS_ORIGIN:-https://shabouautopieces.tn,https://www.shabouautopieces.tn}

# Never use wildcard in production!
```

#### Step 4.3: Update Dockerfiles to include shared library

**Orion Dockerfile:**
```dockerfile
# Add after WORKDIR /app

# Copy shared library
COPY --from=builder /app/../../shared /app/shared

# Set PYTHONPATH
ENV PYTHONPATH="${PYTHONPATH}:/app/shared"
```

**Prospector Dockerfile:**
```dockerfile
# Same changes as Orion
COPY --from=builder /app/../../shared /app/shared
ENV PYTHONPATH="${PYTHONPATH}:/app/shared"
```

#### Step 4.4: Rebuild Docker images

```bash
cd backend

# Rebuild all services
docker-compose build

# Should complete without errors
```

---

### Phase 5: Testing & Validation (1 hour)

#### Step 5.1: Start services

```bash
cd backend

# Stop old containers
docker-compose down

# Start updated services
docker-compose up -d

# Check logs
docker-compose logs -f api orion prospector
```

#### Step 5.2: Verify database connections

```bash
# Check Orion can connect
docker-compose exec orion python -c "from app.models.database import engine; print(engine.execute('SELECT 1').scalar())"

# Check Prospector can connect
docker-compose exec prospector python -c "from app.models.database import engine; print(engine.execute('SELECT 1').scalar())"
```

#### Step 5.3: Verify Celery workers

```bash
# Check Orion worker
docker-compose logs orion_worker | grep "celery@"
# Should see: "[INFO] celery@hostname ready"

# Check Prospector worker
docker-compose logs prospector_worker | grep "celery@"
```

#### Step 5.4: Test cost protection

```python
# Test in Prospector container
docker-compose exec prospector python

>>> from shared.utils import CostProtector
>>> import redis
>>> r = redis.from_url("redis://:your_password@redis:6379/0")
>>> cp = CostProtector(r)
>>> cp.register_api("test", daily_limit=10, monthly_limit=100)
>>> cp.can_use_api("test")  # Should return True
True
>>> for i in range(15):
...     cp.record_api_call("test")
>>> cp.can_use_api("test")  # Should return False (exceeded limit)
False
```

#### Step 5.5: Run all tests

```bash
# Orion tests
cd backend/agents/orion
pytest -v

# Prospector tests (if created)
cd backend/agents/prospector
pytest -v

# API tests
cd backend/api
npm test
```

#### Step 5.6: Health checks

```bash
curl http://localhost:3000/api/v1/health
# Should return: {"status":"ok"}

curl http://localhost:8001/health
# Should return: {"status":"ok"}

curl http://localhost:8002/health
# Should return: {"status":"ok"}
```

---

### Phase 6: Update Documentation (30 minutes)

#### Step 6.1: Update README files

```bash
# Update backend/README.md with shared library info
# Update backend/agents/orion/README.md
# Update backend/agents/prospector/README.md
```

#### Step 6.2: Document configuration changes

```bash
# Create CONFIGURATION.md
cat > backend/CONFIGURATION.md << 'EOF'
# Backend Configuration Guide

## Shared Library

All Python agents now use the shared library at `backend/shared/`.

## Environment Variables

### Cost Protection (New)
- `ENABLE_COST_PROTECTION`: Enable API cost limits (default: true)
- `GOOGLE_API_MAX_CALLS_PER_DAY`: Daily Google Places limit (default: 150)
- `GOOGLE_API_MAX_CALLS_PER_MONTH`: Monthly limit (default: 4500)

See .env.example for full list.
EOF
```

---

### Phase 7: Commit Changes (15 minutes)

```bash
cd backend

# Stage changes
git add shared/
git add agents/orion/app/config.py
git add agents/orion/app/models/database.py
git add agents/orion/app/scheduler/celery_app.py
git add agents/prospector/app/config.py
git add agents/prospector/app/models/database.py
git add agents/prospector/app/scheduler/celery_app.py
git add .env.example
git add docker-compose.yml
git add MIGRATION.md
git add CONFIGURATION.md

# Commit
git commit -m "refactor: Implement shared library and cost protection

- Create shared/ library with common database, celery, config utilities
- Eliminate code duplication between Orion and Prospector agents
- Add cost protection for Google Places API (stay within free tier)
- Change Prospector scraping from daily to monthly (cost optimization)
- Fix CORS security issue (remove wildcard)
- Add comprehensive documentation and migration guide

Addresses production readiness issues identified in audit:
- Security: CORS hardening
- Cost: API budget protection
- Maintainability: DRY principle via shared library
- Documentation: Migration guide and configuration docs"

# Push to branch
git push origin refactor/backend-shared-library
```

---

## Rollback Procedure

If migration fails, rollback to backup:

```bash
# Stop services
docker-compose down

# Restore from backup branch
git checkout backup/before-refactor
git checkout -b main  # Or your main branch

# Rebuild
docker-compose build
docker-compose up -d

# Verify services
docker-compose ps
```

---

## Post-Migration Verification Checklist

- [ ] All services start without errors
- [ ] Database connections work (Orion, Prospector)
- [ ] Celery workers are running
- [ ] Celery beat schedules are configured
- [ ] Cost protection is active (check logs for "registered API cost tracker")
- [ ] All API endpoints respond (health checks pass)
- [ ] Existing tests pass
- [ ] No import errors in logs
- [ ] Prometheus metrics are being collected
- [ ] Scraping frequency is monthly (not daily)
- [ ] CORS is restricted (not wildcard)

---

## Troubleshooting

### Issue: Import error "No module named 'shared'"

**Solution:**
```bash
# Verify PYTHONPATH in Docker
docker-compose exec orion env | grep PYTHONPATH
# Should include /app/shared

# If not, check Dockerfile ENV line
```

### Issue: Celery tasks not running

**Solution:**
```bash
# Check celery worker logs
docker-compose logs orion_worker

# Restart worker
docker-compose restart orion_worker
```

### Issue: Cost protection not working

**Solution:**
```bash
# Verify Redis connection
docker-compose exec prospector python -c "import redis; r=redis.from_url('redis://:pass@redis:6379/0'); print(r.ping())"

# Check cost protection is enabled
docker-compose exec prospector python -c "from app.config import settings; print(settings.ENABLE_COST_PROTECTION)"
```

---

## Next Steps After Migration

1. **Monitor cost protection logs** for the first week
2. **Review API usage** in Redis:
   ```bash
   redis-cli KEYS "api_calls:*"
   redis-cli GET "api_calls:google_places:daily"
   ```
3. **Add more shared utilities** as duplication is identified
4. **Increase test coverage** to 70%+
5. **Set up CI/CD pipeline** to automate testing

---

## Questions?

Check:
- `backend/shared/README.md` - Shared library documentation
- `backend/CONFIGURATION.md` - Configuration guide
- GitHub Issues - Known issues and solutions
