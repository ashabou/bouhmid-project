# Shabou Auto Pièces - Monitoring & Observability

Complete monitoring stack with metrics, logs, and alerting for the Shabou Auto Pièces platform.

## 📊 Stack Overview

| Component | Purpose | Port | URL |
|-----------|---------|------|-----|
| **Prometheus** | Metrics collection & storage | 9090 | http://localhost:9090 |
| **Loki** | Log aggregation | 3100 | http://localhost:3100 |
| **Promtail** | Log shipping agent | 9080 | - |
| **Grafana** | Visualization & dashboards | 3001 | http://localhost:3001 |
| **Alertmanager** | Alert management & routing | 9093 | http://localhost:9093 |

## 🚀 Quick Start

### 1. Start All Monitoring Services

```bash
cd backend
docker-compose up -d prometheus loki promtail grafana alertmanager
```

### 2. Access Dashboards

**Grafana**: http://localhost:3001
- Username: `admin` (default)
- Password: Set in `.env` as `GRAFANA_ADMIN_PASSWORD`

**Prometheus**: http://localhost:9090

**Alertmanager**: http://localhost:9093

### 3. Pre-configured Dashboards

Grafana comes with 4 pre-configured dashboards:

1. **API Performance** - Request latency, error rates, cache metrics
2. **Business Metrics** - Product views, leads, forecasts, search queries
3. **Infrastructure** - CPU, memory, disk, network, service health
4. **Logs** - Centralized logs from all services

## 📈 Prometheus Metrics

### Exposed Metrics Endpoints

All services expose metrics at `/metrics`:

- **API**: http://localhost:3000/metrics
- **Prospector**: http://localhost:8001/metrics
- **Orion**: http://localhost:8002/metrics

### Available Metrics

#### API Service (Node.js)

```promql
# HTTP Metrics
shabou_api_http_request_duration_seconds_bucket
shabou_api_http_requests_total
shabou_api_http_errors_total

# Cache Metrics
shabou_api_cache_operations_total{operation="hit|miss|set|delete"}
shabou_api_cache_hit_ratio

# Database Metrics
shabou_api_db_query_duration_seconds
shabou_api_db_connections_active

# Business Metrics
shabou_api_product_views_total
shabou_api_search_queries_total{type="text|barcode|reference"}
```

#### Prospector Agent (Python)

```promql
# Scraping Metrics
prospector_scraping_requests_total{source="google_maps|website", status="success|error"}
prospector_leads_discovered_total{source="google_maps|website"}
prospector_leads_quality_score

# Task Metrics
prospector_celery_task_duration_seconds{task="scrape_google_maps|scrape_website"}
prospector_celery_tasks_total{task="...", status="success|failure"}
```

#### Orion Agent (Python)

```promql
# Forecasting Metrics
orion_forecasts_generated_total{model="prophet|arima|lstm"}
orion_forecast_accuracy{model="prophet|arima|lstm"}

# ML Metrics
orion_model_training_duration_seconds{model_type="prophet|arima|lstm"}
orion_model_predictions_total{model_type="..."}
orion_model_errors_total{error_type="training|prediction"}
```

### Example Queries

```promql
# P95 API response time
histogram_quantile(0.95, rate(shabou_api_http_request_duration_seconds_bucket[5m]))

# Error rate by route
rate(shabou_api_http_errors_total[5m])

# Cache hit ratio
shabou_api_cache_hit_ratio

# Total leads discovered in last hour
increase(prospector_leads_discovered_total[1h])

# Average forecast accuracy
avg(orion_forecast_accuracy)
```

## 📝 Loki Logs

### Log Sources

Loki aggregates logs from:
- API service (Fastify/Winston logs)
- Prospector agent (Python/uvicorn logs)
- Orion agent (Python/uvicorn logs)
- Celery workers (both Prospector and Orion)
- PostgreSQL database
- Redis cache

### LogQL Query Examples

```logql
# All logs from a specific service
{service="api"}

# Error logs only
{app="shabou-autopieces"} | json | level=~"error|ERROR"

# Logs from a specific time range
{service="prospector"} | json | timestamp > "2024-01-01T00:00:00Z"

# Filter by request ID (distributed tracing)
{service="api"} | json | request_id="abc123"

# Search for specific text in logs
{service="orion"} |= "forecast"

# Count errors by service
sum by (service) (count_over_time({app="shabou-autopieces"} | json | level="error" [1h]))
```

### Structured Logging

All application logs are in JSON format for easy parsing:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "service": "api",
  "message": "Request completed",
  "requestId": "req-abc123",
  "userId": "user-456",
  "method": "GET",
  "path": "/api/v1/products",
  "statusCode": 200,
  "duration": 45
}
```

## 🔔 Alerting

### Alert Rules

Alerts are defined in `prometheus/rules/alerts.yml`:

| Alert | Condition | Severity | Description |
|-------|-----------|----------|-------------|
| **HighResponseTime** | P95 > 1s for 5min | warning | API response time too high |
| **HighErrorRate** | Error rate > 5% for 5min | critical | High error rate detected |
| **ServiceDown** | Service unavailable | critical | Service is down |
| **HighCPUUsage** | CPU > 90% for 10min | warning | High CPU usage |
| **HighMemoryUsage** | Memory > 90% for 5min | warning | High memory usage |
| **HighDiskUsage** | Disk > 90% | warning | Disk space running low |
| **PostgreSQLDown** | DB unavailable | critical | Database is down |
| **RedisDown** | Redis unavailable | critical | Cache is down |
| **LowCacheHitRatio** | Hit ratio < 50% for 15min | warning | Cache not effective |
| **HighConnectionCount** | DB connections > 80% | warning | Too many DB connections |
| **CeleryTasksFailing** | Task failure rate > 10% | warning | Celery tasks failing |

### Alert Routing

Alerts are routed to different teams based on severity and type:

- **Critical alerts** → Email + Slack + PagerDuty (optional)
- **Warning alerts** → Email + Slack
- **Infrastructure alerts** → Infrastructure team
- **Database alerts** → Database team
- **Application alerts** → Backend team

### Configuration

Edit `monitoring/alertmanager/alertmanager.yml` to configure:

1. **Email settings** (SMTP)
2. **Slack webhooks**
3. **PagerDuty integration**
4. **Alert routing rules**
5. **Notification templates**

Environment variables in `.env`:

```bash
# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# Alert destinations
ALERT_EMAIL_CRITICAL=oncall@shabouautopieces.tn
ALERT_EMAIL_WARNING=team@shabouautopieces.tn

# Slack (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# PagerDuty (optional)
PAGERDUTY_SERVICE_KEY=your_service_key
```

## 📊 Grafana Dashboards

### Pre-configured Dashboards

#### 1. API Performance
- Request rate (req/s)
- P95/P99 response time
- Error rate by type (4xx, 5xx)
- Cache hit ratio
- Database query duration

#### 2. Business Metrics
- Product views (24h)
- Search queries by type
- Leads discovered by source
- Active forecasts
- Forecast accuracy (MAPE)
- Top 10 viewed products

#### 3. Infrastructure
- CPU usage (gauge + time series)
- Memory usage
- Disk usage
- Network traffic
- Disk I/O
- Service status table

#### 4. Logs
- All service logs (live stream)
- Logs by service (API, Prospector, Orion)
- Error logs only
- Log volume by service
- Celery worker logs

### Creating Custom Dashboards

1. Go to Grafana: http://localhost:3001
2. Click **+** → **Dashboard** → **Add new panel**
3. Select data source (Prometheus or Loki)
4. Write your query
5. Configure visualization
6. Save dashboard

## 🔍 Troubleshooting

### Check Service Health

```bash
# Check if all monitoring services are running
docker-compose ps prometheus loki promtail grafana alertmanager

# View logs
docker-compose logs -f prometheus
docker-compose logs -f loki
docker-compose logs -f grafana
```

### Prometheus Not Scraping Metrics

1. Check if services are exposing `/metrics`:
   ```bash
   curl http://localhost:3000/metrics  # API
   curl http://localhost:8001/metrics  # Prospector
   curl http://localhost:8002/metrics  # Orion
   ```

2. Check Prometheus targets: http://localhost:9090/targets

3. Verify `prometheus.yml` configuration

### Loki Not Receiving Logs

1. Check Promtail is running:
   ```bash
   docker-compose logs promtail
   ```

2. Check Loki API:
   ```bash
   curl http://localhost:3100/ready
   ```

3. Verify log files exist and are accessible

### Alerts Not Firing

1. Check Alertmanager status: http://localhost:9093

2. Verify alert rules are loaded in Prometheus:
   http://localhost:9090/rules

3. Check Alertmanager logs:
   ```bash
   docker-compose logs alertmanager
   ```

4. Test SMTP configuration (for email alerts)

## 📚 Best Practices

### Metrics

✅ **DO**:
- Use counters for events (requests, errors)
- Use histograms for durations and sizes
- Use gauges for current values (connections, queue size)
- Label metrics appropriately (service, status, method)
- Keep cardinality low (avoid high-cardinality labels like user_id)

❌ **DON'T**:
- Create too many unique metric combinations
- Use labels with unbounded values
- Store logs in metrics

### Logs

✅ **DO**:
- Use structured logging (JSON)
- Include correlation IDs (request_id, trace_id)
- Log at appropriate levels (DEBUG, INFO, WARN, ERROR)
- Include context (user_id, service, component)

❌ **DON'T**:
- Log sensitive data (passwords, tokens, PII)
- Create excessive log volume
- Use inconsistent log formats

### Alerts

✅ **DO**:
- Alert on symptoms, not causes
- Make alerts actionable
- Include runbook links
- Set appropriate thresholds
- Use inhibition rules to reduce noise

❌ **DON'T**:
- Alert on everything
- Create alerts without clear remediation
- Set thresholds too low (causing false positives)
- Ignore alert fatigue

## 🔗 Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [Grafana Documentation](https://grafana.com/docs/grafana/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [PromQL Tutorial](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [LogQL Documentation](https://grafana.com/docs/loki/latest/logql/)

## 📞 Support

For monitoring-related issues:
1. Check this documentation
2. Review service logs
3. Consult the troubleshooting section
4. Contact the DevOps team
