# Prospector Agent

Lead generation and web scraping service for Shabou Auto Pièces.

## Overview

The Prospector Agent is a Python FastAPI service that automates lead generation by:
- Scraping Google Places for auto parts suppliers
- Extracting supplier websites for product/pricing data
- Scoring leads based on potential value
- Storing leads in PostgreSQL database

## Features

- **Google Places Integration**: Search for potential suppliers by location
- **Website Scraping**: Extract product and pricing information
- **Lead Scoring**: Automatically score leads based on various factors
- **Async Task Processing**: Celery integration for background scraping
- **RESTful API**: FastAPI endpoints for lead management

## Setup

### Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Redis 7+

### Installation

1. Create virtual environment:
```bash
cd backend/agents/prospector
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Install Playwright browsers (for website scraping):
```bash
playwright install chromium
```

4. Configure environment:
```bash
cp .env.example .env
# Edit .env with your settings
```

### Running

**Development mode:**
```bash
python -m app.main
```

**Production mode:**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

**With Celery worker and beat scheduler:**
```bash
# Terminal 1: Start the worker
./start_celery_worker.sh

# Terminal 2: Start the beat scheduler (for periodic tasks)
./start_celery_beat.sh

# Or manually:
celery -A app.scheduler.celery_app worker --loglevel=info --queues=scraping,processing,maintenance
celery -A app.scheduler.celery_app beat --loglevel=info
```

## API Endpoints

### Health Check
```
GET /health
```

### List Leads
```
GET /api/v1/leads
```

### Scrape Google Places
```
POST /api/v1/scrape/google-places
Body: {
  "query": "auto parts supplier",
  "location": "Tunis, Tunisia",
  "radius": 50000
}
```

## Development

### Project Structure
```
prospector/
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI application
│   ├── config.py         # Configuration settings
│   ├── models/           # SQLAlchemy models
│   ├── scraper/          # Scraping logic
│   ├── scheduler/        # Celery tasks
│   └── utils/            # Utilities
├── requirements.txt
├── .env.example
└── README.md
```

## Background Tasks (Celery)

The Prospector Agent uses Celery for background task processing and scheduled jobs.

### Periodic Tasks

The following tasks run automatically on a schedule:

#### Daily Google Places Scrape
- **Schedule**: Daily at 2:00 AM UTC
- **Task**: `daily_google_places_scrape`
- **Description**: Scrapes multiple locations and queries for auto parts suppliers
- **Searches**: 8 different query/location combinations across major Tunisian cities

#### Website Scraping
- **Schedule**: Every 6 hours
- **Task**: `scrape_lead_websites`
- **Description**: Scrapes websites for leads with websites but few/no products
- **Limit**: 20 websites per run (prioritizes high-score leads)

#### Batch Score Updates
- **Schedule**: Every 4 hours
- **Task**: `batch_update_lead_scores`
- **Description**: Recalculates potential scores for up to 500 leads
- **Purpose**: Keep scores up-to-date as data changes

#### Data Cleanup
- **Schedule**: Daily at 3:00 AM UTC
- **Task**: `cleanup_old_data`
- **Description**: Removes old rejected leads, low-score inactive leads, and orphaned products
- **Retention**: 180 days for rejected leads, 90 days for low-score leads

#### Weekly Report Generation
- **Schedule**: Every Monday at 9:00 AM UTC
- **Task**: `send_weekly_report`
- **Description**: Generates comprehensive weekly report and emails to configured recipients
- **Report Contents**:
  - Summary statistics (total leads, new leads, average score, products)
  - Top 10 highest-scoring leads
  - Week-over-week trends
  - Geographic distribution
  - Source breakdown
  - Score distribution
- **Email Format**: HTML email with styled tables and charts
- **Recipients**: Configured via `REPORT_RECIPIENTS` environment variable

### Manual Tasks

You can trigger tasks manually via Python or the Celery CLI:

```python
from app.scheduler.tasks import scrape_specific_location

# Trigger a manual scrape
result = scrape_specific_location.delay(
    query="auto parts supplier",
    location="Tunis, Tunisia",
    radius=10000,
    max_results=30
)
```

```bash
# Via Celery CLI
celery -A app.scheduler.celery_app call app.scheduler.tasks.scrape_specific_location \
    --args='["auto parts supplier", "Tunis, Tunisia"]' \
    --kwargs='{"radius": 10000, "max_results": 30}'
```

### Task Monitoring

Monitor task status using Celery Flower (optional):

```bash
pip install flower
celery -A app.scheduler.celery_app flower --port=5555
```

Then visit `http://localhost:5555` to see real-time task monitoring.

### Error Handling

All tasks include:
- **Automatic retries**: 2-3 retries with exponential backoff
- **Error logging**: Full stack traces logged to app logs
- **Graceful degradation**: Tasks fail safely without breaking the system
- **Database transaction management**: Automatic rollback on errors

### Task Queues

Tasks are distributed across three queues:
- **scraping**: Heavy scraping tasks (Google Places, websites)
- **processing**: Data processing tasks (score updates)
- **maintenance**: Cleanup and maintenance tasks

## Configuration

All configuration is done through environment variables. See `.env.example` for available options.

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/shabou_autopieces

# Redis/Celery
REDIS_URL=redis://localhost:6379/1
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Google Places API
GOOGLE_PLACES_API_KEY=your_api_key_here

# Email/SMTP (for weekly reports)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_USE_TLS=true
FROM_EMAIL=prospector@shabou-autopieces.tn
FROM_NAME=Prospector Agent
REPORT_RECIPIENTS=owner@shabou-autopieces.tn,manager@shabou-autopieces.tn
```

## License

Proprietary - Shabou Auto Pièces
