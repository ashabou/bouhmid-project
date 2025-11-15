"""
Base Celery configuration for task queue processing.

Provides common Celery setup to eliminate code duplication between agents.
"""

import logging
from typing import Dict, Any, Optional
from celery import Celery

logger = logging.getLogger(__name__)


def get_base_celery_config(
    timezone: str = "UTC",
    task_time_limit: int = 3600,
    task_soft_time_limit: Optional[int] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Get base Celery configuration dictionary.

    Args:
        timezone: Timezone for scheduled tasks (default: UTC)
        task_time_limit: Hard time limit in seconds (default: 1 hour)
        task_soft_time_limit: Soft time limit in seconds (default: task_time_limit - 300)
        **kwargs: Additional config options

    Returns:
        Dictionary of Celery configuration options

    Example:
        >>> config = get_base_celery_config(
        ...     timezone="UTC",
        ...     task_time_limit=1800,
        ...     worker_prefetch_multiplier=2
        ... )
    """
    if task_soft_time_limit is None:
        task_soft_time_limit = max(task_time_limit - 300, 60)

    config = {
        # Serialization
        "task_serializer": "json",
        "accept_content": ["json"],
        "result_serializer": "json",

        # Timezone
        "timezone": timezone,
        "enable_utc": True,

        # Task execution
        "task_track_started": True,
        "task_time_limit": task_time_limit,
        "task_soft_time_limit": task_soft_time_limit,
        "task_acks_late": True,
        "task_reject_on_worker_lost": True,

        # Worker settings
        "worker_prefetch_multiplier": 1,
        "worker_max_tasks_per_child": 1000,

        # Result backend
        "result_expires": 86400,  # 24 hours
        "result_compression": "gzip",

        # Retry settings
        "task_default_retry_delay": 60,
        "task_max_retries": 3,

        # Events
        "task_send_sent_event": True,
    }

    # Override with custom kwargs
    config.update(kwargs)

    return config


def create_celery_app(
    app_name: str,
    broker_url: str,
    result_backend: str,
    include: Optional[list] = None,
    config_overrides: Optional[Dict[str, Any]] = None,
    **base_config_kwargs
) -> Celery:
    """
    Create a configured Celery application.

    Args:
        app_name: Name of the Celery app (e.g., "orion", "prospector")
        broker_url: Redis/RabbitMQ broker URL
        result_backend: Result backend URL (usually same as broker for Redis)
        include: List of modules to import tasks from
        config_overrides: Additional config to override base config
        **base_config_kwargs: Passed to get_base_celery_config()

    Returns:
        Configured Celery application

    Example:
        >>> celery_app = create_celery_app(
        ...     app_name="orion",
        ...     broker_url="redis://localhost:6379/0",
        ...     result_backend="redis://localhost:6379/0",
        ...     include=["app.scheduler.tasks"],
        ...     task_time_limit=3600
        ... )
    """
    logger.info(f"Creating Celery app: {app_name}")

    # Create Celery application
    celery_app = Celery(
        app_name,
        broker=broker_url,
        backend=result_backend,
        include=include or []
    )

    # Get base configuration
    config = get_base_celery_config(**base_config_kwargs)

    # Apply overrides
    if config_overrides:
        config.update(config_overrides)

    # Update Celery configuration
    celery_app.conf.update(config)

    logger.info(
        f"Celery app '{app_name}' configured: "
        f"time_limit={config['task_time_limit']}s, "
        f"timezone={config['timezone']}"
    )

    return celery_app
