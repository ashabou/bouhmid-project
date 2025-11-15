"""
Prometheus Metrics for Prospector Agent

Tracks metrics for lead generation and web scraping operations
"""

from prometheus_client import Counter, Histogram, Gauge, CollectorRegistry, generate_latest, CONTENT_TYPE_LATEST

# Create custom registry
registry = CollectorRegistry()

# ========================================
# Scraping Metrics
# ========================================

scraping_requests_total = Counter(
    'prospector_scraping_requests_total',
    'Total number of scraping requests',
    ['source', 'status'],
    registry=registry
)

scraping_duration_seconds = Histogram(
    'prospector_scraping_duration_seconds',
    'Duration of scraping operations in seconds',
    ['source'],
    buckets=[1, 5, 10, 30, 60, 120, 300, 600],
    registry=registry
)

scraping_errors_total = Counter(
    'prospector_scraping_errors_total',
    'Total number of scraping errors',
    ['source', 'error_type'],
    registry=registry
)

# ========================================
# Lead Metrics
# ========================================

leads_discovered_total = Counter(
    'prospector_leads_discovered_total',
    'Total number of leads discovered',
    ['source'],
    registry=registry
)

leads_quality_score = Histogram(
    'prospector_leads_quality_score',
    'Quality score distribution of leads',
    buckets=[0, 20, 40, 60, 80, 100],
    registry=registry
)

leads_active = Gauge(
    'prospector_leads_active',
    'Number of currently active leads',
    registry=registry
)

leads_by_status = Gauge(
    'prospector_leads_by_status',
    'Number of leads by status',
    ['status'],
    registry=registry
)

# ========================================
# Google Places API Metrics
# ========================================

google_api_requests_total = Counter(
    'prospector_google_api_requests_total',
    'Total number of Google Places API requests',
    ['status'],
    registry=registry
)

google_api_quota_remaining = Gauge(
    'prospector_google_api_quota_remaining',
    'Remaining Google API quota',
    registry=registry
)

# ========================================
# Celery Task Metrics
# ========================================

celery_tasks_total = Counter(
    'prospector_celery_tasks_total',
    'Total number of Celery tasks',
    ['task_name', 'status'],
    registry=registry
)

celery_task_duration_seconds = Histogram(
    'prospector_celery_task_duration_seconds',
    'Duration of Celery tasks in seconds',
    ['task_name'],
    buckets=[1, 5, 10, 30, 60, 300, 600, 1800, 3600],
    registry=registry
)

# ========================================
# Helper Functions
# ========================================

def record_scraping_request(source: str, status: str, duration_seconds: float):
    """Record a scraping request"""
    scraping_requests_total.labels(source=source, status=status).inc()
    scraping_duration_seconds.labels(source=source).observe(duration_seconds)


def record_scraping_error(source: str, error_type: str):
    """Record a scraping error"""
    scraping_errors_total.labels(source=source, error_type=error_type).inc()


def record_lead_discovered(source: str, quality_score: float):
    """Record a new lead"""
    leads_discovered_total.labels(source=source).inc()
    leads_quality_score.observe(quality_score)


def update_lead_counts(status_counts: dict):
    """Update lead counts by status"""
    for status, count in status_counts.items():
        leads_by_status.labels(status=status).set(count)


def record_google_api_request(status: str):
    """Record a Google API request"""
    google_api_requests_total.labels(status=status).inc()


def update_google_api_quota(remaining: int):
    """Update Google API quota"""
    google_api_quota_remaining.set(remaining)


def record_celery_task(task_name: str, status: str, duration_seconds: float = None):
    """Record Celery task execution"""
    celery_tasks_total.labels(task_name=task_name, status=status).inc()
    if duration_seconds is not None:
        celery_task_duration_seconds.labels(task_name=task_name).observe(duration_seconds)


def get_metrics():
    """Get metrics in Prometheus format"""
    return generate_latest(registry)


def get_content_type():
    """Get Prometheus content type"""
    return CONTENT_TYPE_LATEST
