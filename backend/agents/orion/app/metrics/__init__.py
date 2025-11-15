"""Metrics module for Orion agent"""

from .prometheus import (
    get_metrics,
    get_content_type,
    record_forecast_generated,
    record_model_training,
    record_model_prediction,
    record_model_error,
    record_sales_data_processing,
    update_data_quality,
    record_insight_generated,
    record_celery_task,
    update_active_forecasts,
)

__all__ = [
    'get_metrics',
    'get_content_type',
    'record_forecast_generated',
    'record_model_training',
    'record_model_prediction',
    'record_model_error',
    'record_sales_data_processing',
    'update_data_quality',
    'record_insight_generated',
    'record_celery_task',
    'update_active_forecasts',
]
