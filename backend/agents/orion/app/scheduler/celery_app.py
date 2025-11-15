"""
Celery Application Configuration

Configures Celery for background task processing and scheduling
"""
import logging
from celery import Celery
from celery.schedules import crontab
from ..config import settings

logger = logging.getLogger(__name__)

# Create Celery application
celery_app = Celery(
    'orion',
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=['app.scheduler.tasks']
)

# Celery configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max per task
    task_soft_time_limit=3000,  # 50 minutes soft limit
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    result_expires=86400,  # Results expire after 24 hours
)

# Scheduled tasks (Celery Beat)
celery_app.conf.beat_schedule = {
    # Daily forecast generation at 2 AM UTC
    'generate-daily-forecasts': {
        'task': 'app.scheduler.tasks.generate_all_forecasts',
        'schedule': crontab(hour=2, minute=0),  # 2:00 AM UTC daily
        'options': {
            'expires': 3600,  # Task expires if not picked up in 1 hour
        }
    },

    # Update forecast actuals at 1 AM UTC (after daily sales data is loaded)
    'update-forecast-actuals': {
        'task': 'app.scheduler.tasks.update_all_forecast_actuals',
        'schedule': crontab(hour=1, minute=0),  # 1:00 AM UTC daily
        'options': {
            'expires': 3600,
        }
    },

    # Generate insights every 6 hours
    'generate-insights': {
        'task': 'app.scheduler.tasks.generate_all_insights',
        'schedule': crontab(hour='*/6', minute=0),  # Every 6 hours
        'options': {
            'expires': 3600,
        }
    },

    # Weekly accuracy report on Mondays at 8 AM UTC
    'weekly-accuracy-report': {
        'task': 'app.scheduler.tasks.generate_weekly_accuracy_report',
        'schedule': crontab(day_of_week=1, hour=8, minute=0),  # Monday 8:00 AM UTC
        'options': {
            'expires': 7200,
        }
    },

    # Cleanup old forecasts monthly (first day of month at 3 AM UTC)
    'cleanup-old-forecasts': {
        'task': 'app.scheduler.tasks.cleanup_old_data',
        'schedule': crontab(day_of_month=1, hour=3, minute=0),  # 1st of month, 3:00 AM UTC
        'options': {
            'expires': 7200,
        }
    },
}

logger.info("Celery app configured with beat schedule")
