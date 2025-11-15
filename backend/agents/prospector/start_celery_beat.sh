#!/bin/bash
# Celery Beat Startup Script
# Starts the Celery beat scheduler for periodic tasks

set -e

echo "Starting Celery beat scheduler for Prospector Agent..."

# Set Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Start Celery beat
celery -A app.scheduler.celery_app beat \
    --loglevel=info \
    --scheduler=celery.beat:PersistentScheduler \
    --logfile=logs/celery_beat.log \
    --pidfile=tmp/celery_beat.pid

# Options explained:
# --loglevel=info: Set logging level
# --scheduler: Use persistent scheduler (stores schedule in database)
# --logfile: Log file location
# --pidfile: PID file for process management
