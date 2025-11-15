/**
 * Prometheus Metrics Configuration
 *
 * Collects and exposes metrics for:
 * - HTTP request duration and count
 * - Error rates
 * - Cache hit/miss ratio
 * - Database query performance
 * - Custom business metrics
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a Registry
export const register = new Registry();

// Add default metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({
  register,
  prefix: 'shabou_api_',
  labels: { service: 'api' },
});

// ========================================
// HTTP Metrics
// ========================================

/**
 * HTTP request duration in seconds
 */
export const httpRequestDuration = new Histogram({
  name: 'shabou_api_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 1, 2, 5],
  registers: [register],
});

/**
 * HTTP request count
 */
export const httpRequestCount = new Counter({
  name: 'shabou_api_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

/**
 * HTTP errors count
 */
export const httpErrorCount = new Counter({
  name: 'shabou_api_http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'status_code', 'error_type'],
  registers: [register],
});

// ========================================
// Cache Metrics
// ========================================

/**
 * Cache operations count
 */
export const cacheOperations = new Counter({
  name: 'shabou_api_cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

/**
 * Cache hit ratio (calculated gauge)
 */
export const cacheHitRatio = new Gauge({
  name: 'shabou_api_cache_hit_ratio',
  help: 'Cache hit ratio (hits / total operations)',
  registers: [register],
});

// ========================================
// Database Metrics
// ========================================

/**
 * Database query duration
 */
export const dbQueryDuration = new Histogram({
  name: 'shabou_api_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

/**
 * Database query count
 */
export const dbQueryCount = new Counter({
  name: 'shabou_api_db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'model', 'status'],
  registers: [register],
});

/**
 * Active database connections
 */
export const dbConnectionsActive = new Gauge({
  name: 'shabou_api_db_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

// ========================================
// Business Metrics
// ========================================

/**
 * Product views
 */
export const productViews = new Counter({
  name: 'shabou_api_product_views_total',
  help: 'Total number of product views',
  labelNames: ['product_id'],
  registers: [register],
});

/**
 * Search queries
 */
export const searchQueries = new Counter({
  name: 'shabou_api_search_queries_total',
  help: 'Total number of search queries',
  labelNames: ['query_type'],
  registers: [register],
});

/**
 * API calls by endpoint
 */
export const endpointCalls = new Counter({
  name: 'shabou_api_endpoint_calls_total',
  help: 'Total number of calls per endpoint',
  labelNames: ['endpoint', 'method'],
  registers: [register],
});

// ========================================
// Authentication Metrics
// ========================================

/**
 * Authentication attempts
 */
export const authAttempts = new Counter({
  name: 'shabou_api_auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['status', 'type'],
  registers: [register],
});

/**
 * Active sessions
 */
export const activeSessions = new Gauge({
  name: 'shabou_api_active_sessions',
  help: 'Number of active user sessions',
  registers: [register],
});

// ========================================
// Helper Functions
// ========================================

/**
 * Update cache hit ratio
 */
let cacheHits = 0;
let cacheMisses = 0;

export function recordCacheHit() {
  cacheHits++;
  cacheOperations.inc({ operation: 'get', status: 'hit' });
  updateCacheHitRatio();
}

export function recordCacheMiss() {
  cacheMisses++;
  cacheOperations.inc({ operation: 'get', status: 'miss' });
  updateCacheHitRatio();
}

function updateCacheHitRatio() {
  const total = cacheHits + cacheMisses;
  if (total > 0) {
    cacheHitRatio.set(cacheHits / total);
  }
}

/**
 * Record database query
 */
export function recordDbQuery(
  operation: string,
  model: string,
  durationMs: number,
  status: 'success' | 'error' = 'success'
) {
  dbQueryDuration.observe({ operation, model }, durationMs / 1000);
  dbQueryCount.inc({ operation, model, status });
}

/**
 * Record HTTP request
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationMs: number
) {
  const labels = { method, route, status_code: statusCode.toString() };
  httpRequestDuration.observe(labels, durationMs / 1000);
  httpRequestCount.inc(labels);

  // Record errors (4xx, 5xx)
  if (statusCode >= 400) {
    const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
    httpErrorCount.inc({ ...labels, error_type: errorType });
  }
}

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get metrics as JSON (for debugging)
 */
export async function getMetricsJSON(): Promise<any> {
  return register.getMetricsAsJSON();
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics(): void {
  register.resetMetrics();
  cacheHits = 0;
  cacheMisses = 0;
}
