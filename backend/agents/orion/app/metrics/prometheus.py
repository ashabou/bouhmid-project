"""
Prometheus Metrics for Orion Agent

Tracks metrics for ML forecasting and demand prediction operations
"""

from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST

# Create custom registry
registry = CollectorRegistry()

# ========================================
# Forecasting Metrics
# ========================================

forecasts_generated_total = Counter(
    'orion_forecasts_generated_total',
    'Total number of forecasts generated',
    ['model_type', 'status'],
    registry=registry
)

forecast_accuracy = Histogram(
    'orion_forecast_accuracy',
    'Forecast accuracy (MAPE - Mean Absolute Percentage Error)',
    buckets=[5, 10, 15, 20, 25, 30, 40, 50, 75, 100],
    registry=registry
)

forecast_duration_seconds = Histogram(
    'orion_forecast_duration_seconds',
    'Duration of forecast generation in seconds',
    ['model_type'],
    buckets=[1, 5, 10, 30, 60, 120, 300, 600, 1800],
    registry=registry
)

active_forecasts = Gauge(
    'orion_active_forecasts',
    'Number of active forecasts',
    registry=registry
)

# ========================================
# Model Metrics
# ========================================

model_training_duration_seconds = Histogram(
    'orion_model_training_duration_seconds',
    'Duration of model training in seconds',
    ['model_type'],
    buckets=[1, 10, 30, 60, 300, 600, 1800, 3600],
    registry=registry
)

model_predictions_total = Counter(
    'orion_model_predictions_total',
    'Total number of model predictions',
    ['model_type'],
    registry=registry
)

model_errors_total = Counter(
    'orion_model_errors_total',
    'Total number of model errors',
    ['model_type', 'error_type'],
    registry=registry
)

model_accuracy_score = Gauge(
    'orion_model_accuracy_score',
    'Current model accuracy score',
    ['model_type'],
    registry=registry
)

# ========================================
# Data Metrics
# ========================================

sales_records_processed_total = Counter(
    'orion_sales_records_processed_total',
    'Total number of sales records processed',
    ['status'],
    registry=registry
)

sales_data_quality_score = Gauge(
    'orion_sales_data_quality_score',
    'Data quality score (0-100)',
    registry=registry
)

missing_data_points = Gauge(
    'orion_missing_data_points',
    'Number of missing data points in dataset',
    registry=registry
)

# ========================================
# Insights Metrics
# ========================================

insights_generated_total = Counter(
    'orion_insights_generated_total',
    'Total number of insights generated',
    ['insight_type'],
    registry=registry
)

insights_confidence_score = Histogram(
    'orion_insights_confidence_score',
    'Confidence score of generated insights',
    buckets=[0, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0],
    registry=registry
)

# ========================================
# Celery Task Metrics
# ========================================

celery_tasks_total = Counter(
    'orion_celery_tasks_total',
    'Total number of Celery tasks',
    ['task_name', 'status'],
    registry=registry
)

celery_task_duration_seconds = Histogram(
    'orion_celery_task_duration_seconds',
    'Duration of Celery tasks in seconds',
    ['task_name'],
    buckets=[1, 5, 10, 30, 60, 300, 600, 1800, 3600, 7200],
    registry=registry
)

# ========================================
# Helper Functions
# ========================================

def record_forecast_generated(model_type: str, status: str, duration_seconds: float, mape: float = None):
    """Record a generated forecast"""
    forecasts_generated_total.labels(model_type=model_type, status=status).inc()
    forecast_duration_seconds.labels(model_type=model_type).observe(duration_seconds)
    if mape is not None:
        forecast_accuracy.observe(mape)


def record_model_training(model_type: str, duration_seconds: float, accuracy_score: float = None):
    """Record model training"""
    model_training_duration_seconds.labels(model_type=model_type).observe(duration_seconds)
    if accuracy_score is not None:
        model_accuracy_score.labels(model_type=model_type).set(accuracy_score)


def record_model_prediction(model_type: str):
    """Record a model prediction"""
    model_predictions_total.labels(model_type=model_type).inc()


def record_model_error(model_type: str, error_type: str):
    """Record a model error"""
    model_errors_total.labels(model_type=model_type, error_type=error_type).inc()


def record_sales_data_processing(count: int, status: str):
    """Record sales data processing"""
    sales_records_processed_total.labels(status=status).inc(count)


def update_data_quality(quality_score: float, missing_points: int):
    """Update data quality metrics"""
    sales_data_quality_score.set(quality_score)
    missing_data_points.set(missing_points)


def record_insight_generated(insight_type: str, confidence: float):
    """Record a generated insight"""
    insights_generated_total.labels(insight_type=insight_type).inc()
    insights_confidence_score.observe(confidence)


def record_celery_task(task_name: str, status: str, duration_seconds: float = None):
    """Record Celery task execution"""
    celery_tasks_total.labels(task_name=task_name, status=status).inc()
    if duration_seconds is not None:
        celery_task_duration_seconds.labels(task_name=task_name).observe(duration_seconds)


def update_active_forecasts(count: int):
    """Update active forecasts count"""
    active_forecasts.set(count)


def get_metrics():
    """Get metrics in Prometheus format"""
    return generate_latest(registry)


def get_content_type():
    """Get Prometheus content type"""
    return CONTENT_TYPE_LATEST
