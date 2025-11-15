"""
Celery application configuration for Prospector Agent

This module configures the Celery task queue for:
- Daily Google Places scraping
- Website scraping for leads
- Batch score updates
- Data cleanup tasks
"""
import logging
from celery import Celery
from celery.schedules import crontab
from ..config import settings

logger = logging.getLogger(__name__)

# Initialize Celery app
celery_app = Celery(
    "prospector",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.scheduler.tasks"]
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Task execution settings
    task_acks_late=True,  # Acknowledge tasks after completion
    task_reject_on_worker_lost=True,  # Reject tasks if worker dies
    task_time_limit=1800,  # 30 minute hard limit
    task_soft_time_limit=1500,  # 25 minute soft limit

    # Retry settings
    task_default_retry_delay=60,  # 1 minute default retry delay
    task_max_retries=3,  # Maximum 3 retries by default

    # Result backend settings
    result_expires=86400,  # Results expire after 24 hours
    result_compression="gzip",

    # Worker settings
    worker_prefetch_multiplier=1,  # Disable prefetching for long tasks
    worker_max_tasks_per_child=50,  # Restart worker after 50 tasks (memory leak prevention)

    # Error handling
    task_track_started=True,  # Track when tasks start
    task_send_sent_event=True,  # Send event when task is sent
)

# Periodic task schedule
celery_app.conf.beat_schedule = {
    # Daily Google Places scraping (runs at 2 AM UTC)
    "daily-google-places-scrape": {
        "task": "app.scheduler.tasks.daily_google_places_scrape",
        "schedule": crontab(hour=2, minute=0),
        "options": {
            "expires": 7200,  # Expire after 2 hours if not executed
        },
    },

    # Scrape websites for leads (runs every 6 hours)
    "scrape-lead-websites": {
        "task": "app.scheduler.tasks.scrape_lead_websites",
        "schedule": crontab(hour="*/6", minute=0),
        "options": {
            "expires": 3600,
        },
    },

    # Batch update lead scores (runs every 4 hours)
    "batch-update-lead-scores": {
        "task": "app.scheduler.tasks.batch_update_lead_scores",
        "schedule": crontab(hour="*/4", minute=30),
        "options": {
            "expires": 3600,
        },
    },

    # Cleanup old data (runs daily at 3 AM UTC)
    "cleanup-old-data": {
        "task": "app.scheduler.tasks.cleanup_old_data",
        "schedule": crontab(hour=3, minute=0),
        "options": {
            "expires": 7200,
        },
    },
}

# Task routes (can route specific tasks to specific queues)
celery_app.conf.task_routes = {
    "app.scheduler.tasks.daily_google_places_scrape": {"queue": "scraping"},
    "app.scheduler.tasks.scrape_lead_websites": {"queue": "scraping"},
    "app.scheduler.tasks.batch_update_lead_scores": {"queue": "processing"},
    "app.scheduler.tasks.cleanup_old_data": {"queue": "maintenance"},
}

logger.info("Celery app configured successfully")
