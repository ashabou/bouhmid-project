# Shared Backend Library

Common utilities and configuration shared across all Shabou Auto Pièces backend services (API, Orion, Prospector).

## Purpose

This library eliminates code duplication by providing:
- **Database setup**: Standardized SQLAlchemy configuration
- **Celery configuration**: Common task queue setup
- **Base settings**: Shared configuration management with Pydantic
- **Cost protection**: API call tracking to prevent budget overruns
- **Monitoring utilities**: Common logging and metrics setup

## Installation

From an agent directory (e.g., `agents/orion` or `agents/prospector`):

```bash
# Add to PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:/app/../../shared"

# Or install in development mode
cd ../../shared
pip install -e .
```

## Usage Examples

### Database Setup

```python
from shared.database import create_database_engine, get_session_factory, init_db

# Create engine
engine = create_database_engine(
    database_url=settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20
)

# Create session factory
SessionLocal = get_session_factory(engine)

# Initialize database (create tables)
init_db(engine)

# Use in FastAPI dependency injection
from shared.database import get_db

@app.get("/items")
def list_items(db: Session = Depends(lambda: get_db(SessionLocal))):
    return db.query(Item).all()
```

### Celery Configuration

```python
from shared.celery import create_celery_app
from celery.schedules import crontab

# Create Celery app with standard configuration
celery_app = create_celery_app(
    app_name="orion",
    broker_url=settings.CELERY_BROKER_URL,
    result_backend=settings.CELERY_RESULT_BACKEND,
    include=["app.scheduler.tasks"],
    task_time_limit=3600
)

# Add scheduled tasks
celery_app.conf.beat_schedule = {
    "daily-task": {
        "task": "app.scheduler.tasks.daily_task",
        "schedule": crontab(hour=2, minute=0)
    }
}
```

### Settings Management

```python
from shared.config import BaseSettings

class OrionSettings(BaseSettings):
    """Orion-specific settings extending base."""
    APP_NAME: str = "Orion Agent"
    VERSION: str = "1.0.0"

    # ML-specific settings
    FORECAST_HORIZON_DAYS: int = 30
    MODEL_RETRAIN_DAYS: int = 7

settings = OrionSettings()

# Access common fields
print(settings.DATABASE_URL)
print(settings.is_production)  # Helper property
```

### Cost Protection

```python
from shared.utils import CostProtector
import redis

# Initialize Redis client
redis_client = redis.from_url(settings.REDIS_URL)

# Create cost protector
cost_protector = CostProtector(redis_client=redis_client, enabled=True)

# Register APIs with limits
cost_protector.register_api(
    service_name="google_places",
    daily_limit=150,  # Stay within free tier
    monthly_limit=4500
)

# Check before making API calls
if cost_protector.can_use_api("google_places"):
    result = call_google_places_api()
    cost_protector.record_api_call("google_places", count=1)
else:
    logger.error("API budget exhausted - skipping call")

# Get statistics
stats = cost_protector.get_all_stats()
print(f"Google Places: {stats['google_places'].calls_today} calls today")
```

## Directory Structure

```
shared/
├── __init__.py
├── README.md
├── requirements.txt
├── database/
│   ├── __init__.py
│   ├── base.py          # Engine and session factory creation
│   └── session.py       # Session management and init_db
├── celery/
│   ├── __init__.py
│   └── base.py          # Celery app creation and config
├── config/
│   ├── __init__.py
│   └── base.py          # BaseSettings class
├── monitoring/
│   ├── __init__.py
│   ├── logging.py       # Logging configuration
│   └── metrics.py       # Prometheus metrics base
├── models/
│   ├── __init__.py
│   └── mixins.py        # Common model mixins (timestamps, to_dict)
└── utils/
    ├── __init__.py
    ├── cost_protection.py  # API call tracking
    └── errors.py           # Common error handlers
```

## Benefits

1. **DRY Principle**: Write once, use everywhere
2. **Consistency**: Same patterns across all services
3. **Maintainability**: Fix bugs in one place
4. **Testing**: Shared code is easier to test
5. **Cost Safety**: Built-in budget protection

## Migration from Old Code

See `MIGRATION.md` in the backend root for detailed migration instructions.
