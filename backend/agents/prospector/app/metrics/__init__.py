"""Metrics module for Prospector agent"""

from .prometheus import (
    get_metrics,
    get_content_type,
    record_scraping_request,
    record_scraping_error,
    record_lead_discovered,
    update_lead_counts,
    record_google_api_request,
    update_google_api_quota,
    record_celery_task,
)

__all__ = [
    'get_metrics',
    'get_content_type',
    'record_scraping_request',
    'record_scraping_error',
    'record_lead_discovered',
    'update_lead_counts',
    'record_google_api_request',
    'update_google_api_quota',
    'record_celery_task',
]
