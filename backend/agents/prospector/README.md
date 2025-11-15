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

**With Celery worker:**
```bash
celery -A app.celery_app worker --loglevel=info
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

## Configuration

All configuration is done through environment variables. See `.env.example` for available options.

## License

Proprietary - Shabou Auto Pièces
