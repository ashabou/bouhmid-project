#!/bin/bash
# Celery Worker Startup Script
# Starts the Celery worker process for background task execution

set -e

echo "Starting Celery worker for Prospector Agent..."

# Set Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Start Celery worker
celery -A app.scheduler.celery_app worker \
    --loglevel=info \
    --concurrency=4 \
    --max-tasks-per-child=50 \
    --queues=scraping,processing,maintenance \
    --logfile=logs/celery_worker.log \
    --pidfile=tmp/celery_worker.pid

# Options explained:
# --loglevel=info: Set logging level
# --concurrency=4: Number of worker processes
# --max-tasks-per-child=50: Restart worker after 50 tasks (prevents memory leaks)
# --queues: Listen to specific queues
# --logfile: Log file location
# --pidfile: PID file for process management
