# Orion Agent

ML-powered demand forecasting service for Shabou Auto Pièces.

## Overview

The Orion Agent is a Python FastAPI service that provides demand forecasting by:
- Importing historical sales data from CSV files
- Training ML models (SARIMA, Prophet, Ensemble)
- Generating future demand forecasts
- Creating actionable insights and recommendations
- Monitoring forecast accuracy

## Features

- **Sales History Management**: Import and manage historical sales data
- **ML-Powered Forecasting**: Multiple forecasting models (SARIMA, Prophet, Ensemble)
- **Automated Insights**: Generate actionable business recommendations
- **Accuracy Tracking**: Monitor and evaluate forecast performance
- **Async Task Processing**: Celery integration for background model training
- **RESTful API**: Fast API endpoints for forecast management

## Setup

### Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Redis 7+
- Minimum 1 year of historical sales data

### Installation

1. Create virtual environment:
```bash
cd backend/agents/orion
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment:
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
uvicorn app.main:app --host 0.0.0.0 --port 8002
```

**With Celery worker and beat scheduler:**
```bash
# Terminal 1: Start the worker
./start_celery_worker.sh

# Terminal 2: Start the beat scheduler (for periodic tasks)
./start_celery_beat.sh
```

## API Endpoints

### Health Check
```
GET /health
```

### Sales History
```
GET /api/v1/sales-history
POST /api/v1/sales-history/import
```

### Forecasts
```
GET /api/v1/forecasts
POST /api/v1/forecasts/generate
GET /api/v1/forecasts/{forecast_id}
PATCH /api/v1/forecasts/{forecast_id}/actual
```

### Insights
```
GET /api/v1/insights
GET /api/v1/insights/{insight_id}
PATCH /api/v1/insights/{insight_id}
```

## ML Models

### SARIMA (Seasonal AutoRegressive Integrated Moving Average)
- Best for: Products with clear seasonal patterns
- Requires: Minimum 2 years of data
- Hyperparameters: Configurable via settings

### Prophet (Facebook's Time Series Model)
- Best for: Products with strong trends and holidays
- Requires: Minimum 1 year of data
- Handles: Missing data, outliers, holidays

### Ensemble
- Combines SARIMA and Prophet predictions
- Uses weighted average based on historical accuracy
- Most robust for varied product patterns

## Forecasting Workflow

1. **Import Sales History**
   - Upload CSV with historical sales data
   - Data validation and cleaning
   - Store in database

2. **Generate Forecasts**
   - Select products/categories
   - Choose forecast horizon (7, 14, 30, 90 days)
   - Train models asynchronously
   - Store predictions

3. **Review Insights**
   - Automatic insight generation
   - Stockout risk alerts
   - Reorder recommendations
   - Demand trend notifications

4. **Monitor Accuracy**
   - Compare forecasts with actuals
   - Calculate MAPE, MAE, RMSE
   - Retrain models weekly

## Project Structure
```
orion/
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI application
│   ├── config.py         # Configuration settings
│   ├── models/           # SQLAlchemy models
│   │   ├── database.py
│   │   ├── sales_history.py
│   │   ├── forecast.py
│   │   ├── forecast_insight.py
│   │   └── schemas.py
│   ├── forecasting/      # ML models and forecasting logic
│   ├── data/             # Data import and validation
│   ├── routes/           # API routes
│   └── utils/            # Utilities
├── requirements.txt
├── .env.example
└── README.md
```

## Configuration

All configuration is done through environment variables. See `.env.example` for available options.

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/shabou_autopieces

# Redis/Celery
REDIS_URL=redis://localhost:6379/2
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# Forecasting
MIN_HISTORY_DAYS=365
FORECAST_HORIZON_DAYS=30
```

## Data Requirements

### Sales History CSV Format

Required columns:
- `sale_date` (YYYY-MM-DD)
- `quantity_sold` (integer)
- `unit_price` (decimal)

Optional columns:
- `product_id` (UUID)
- `sku` (string)
- `product_name` (string)
- `brand_id` (integer)
- `category_id` (integer)
- `customer_type` (string)

Example:
```csv
sale_date,sku,product_name,quantity_sold,unit_price,category_id
2023-01-01,BRK-001,Brake Pads,5,45.00,1
2023-01-02,OIL-123,Engine Oil,10,25.50,2
```

## Performance Metrics

The system tracks:
- **MAE** (Mean Absolute Error): Average prediction error
- **MAPE** (Mean Absolute Percentage Error): Percentage-based error
- **RMSE** (Root Mean Squared Error): Penalizes large errors
- **R²** (R-squared): Variance explained by model

Target: MAPE < 30% for production use

## License

Proprietary - Shabou Auto Pièces
