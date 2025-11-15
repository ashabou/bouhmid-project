"""
Pytest configuration and fixtures for Orion tests
"""
import pytest
import pandas as pd
import numpy as np
from datetime import date, datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.database import Base
from app.models import SalesHistory, Forecast, ForecastInsight
from app.models.forecast_insight import InsightType, Severity


@pytest.fixture(scope="session")
def engine():
    """Create test database engine (in-memory SQLite)"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture(scope="function")
def db_session(engine):
    """Create database session for tests"""
    Session = sessionmaker(bind=engine)
    session = Session()

    yield session

    # Cleanup after test
    session.rollback()
    session.close()


@pytest.fixture
def sample_sales_data():
    """Generate sample sales history data for testing"""
    # Generate 400 days of daily sales data
    start_date = date.today() - timedelta(days=400)
    dates = [start_date + timedelta(days=i) for i in range(400)]

    # Simulate realistic sales with trend and seasonality
    np.random.seed(42)
    trend = np.linspace(50, 80, 400)
    seasonality = 20 * np.sin(np.linspace(0, 8 * np.pi, 400))  # Weekly pattern
    noise = np.random.normal(0, 5, 400)
    quantity_sold = np.maximum(0, trend + seasonality + noise).astype(int)

    data = pd.DataFrame({
        'sale_date': dates,
        'quantity_sold': quantity_sold,
        'revenue': quantity_sold * 25.0  # Assume $25 per unit
    })

    return data


@pytest.fixture
def sales_history_records(db_session, sample_sales_data):
    """Create sales history records in database"""
    product_id = "12345678-1234-1234-1234-123456789012"
    sku = "TEST-SKU-001"

    records = []
    for _, row in sample_sales_data.iterrows():
        record = SalesHistory(
            product_id=product_id,
            sku=sku,
            sale_date=row['sale_date'],
            quantity_sold=row['quantity_sold'],
            revenue=row['revenue'],
            data_source='test'
        )
        db_session.add(record)
        records.append(record)

    db_session.commit()
    return records


@pytest.fixture
def sample_forecast_data():
    """Generate sample forecast data"""
    start_date = date.today()
    dates = [start_date + timedelta(days=i) for i in range(30)]

    np.random.seed(42)
    predicted = np.random.uniform(50, 100, 30)

    data = []
    for i, forecast_date in enumerate(dates):
        data.append({
            'forecast_date': forecast_date,
            'predicted_quantity': predicted[i],
            'confidence_interval_lower': predicted[i] * 0.8,
            'confidence_interval_upper': predicted[i] * 1.2,
            'confidence_score': 0.95
        })

    return data


@pytest.fixture
def forecast_records(db_session, sample_forecast_data):
    """Create forecast records in database"""
    product_id = "12345678-1234-1234-1234-123456789012"
    sku = "TEST-SKU-001"

    records = []
    for forecast_data in sample_forecast_data:
        record = Forecast(
            product_id=product_id,
            sku=sku,
            forecast_date=forecast_data['forecast_date'],
            forecast_horizon='30-day',
            predicted_quantity=forecast_data['predicted_quantity'],
            confidence_interval_lower=forecast_data['confidence_interval_lower'],
            confidence_interval_upper=forecast_data['confidence_interval_upper'],
            confidence_score=forecast_data['confidence_score'],
            model_name='SARIMA',
            model_version='1.0'
        )
        db_session.add(record)
        records.append(record)

    db_session.commit()
    return records


@pytest.fixture
def sample_insight():
    """Create sample insight data"""
    return {
        'insight_type': InsightType.DEMAND_SPIKE,
        'severity': Severity.HIGH,
        'product_id': "12345678-1234-1234-1234-123456789012",
        'title': 'Test Demand Spike',
        'description': 'Test spike detected',
        'recommendation': 'Increase inventory',
        'data': {'spike_value': 150},
        'valid_from': date.today(),
        'valid_until': date.today() + timedelta(days=30)
    }


@pytest.fixture
def insight_record(db_session, sample_insight):
    """Create insight record in database"""
    insight = ForecastInsight(**sample_insight)
    db_session.add(insight)
    db_session.commit()
    return insight


@pytest.fixture
def mock_trained_model():
    """Mock trained model data"""
    return {
        'success': True,
        'model_type': 'SARIMA',
        'order': (1, 1, 1),
        'seasonal_order': (1, 1, 1, 12),
        'aic': 1234.56,
        'bic': 1245.67,
        'training_samples': 365,
        'metrics': {
            'mae': 5.2,
            'rmse': 7.1,
            'mape': 8.5,
            'r2_score': 0.85
        }
    }
