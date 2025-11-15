import type { FastifyCorsOptions } from '@fastify/cors';
import { logger } from '../shared/logger/winston.config.js';

/**
 * Allowed origins for CORS
 * Environment-specific configuration
 */
const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];

  // Production origins
  if (process.env.NODE_ENV === 'production') {
    origins.push(
      'https://shabouautopieces.tn',
      'https://www.shabouautopieces.tn'
    );
  }

  // Staging origins
  if (process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'development') {
    origins.push(
      'https://staging.shabouautopieces.tn',
      'https://staging-www.shabouautopieces.tn'
    );
  }

  // Development origins
  if (process.env.NODE_ENV === 'development') {
    origins.push(
      'http://localhost:5173',  // Vite default
      'http://localhost:3000',  // Alternative
      'http://localhost:3001',  // Grafana (for dashboard embedding)
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    );
  }

  // Custom origin from env (for flexibility)
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }

  // Additional custom origins from comma-separated list
  if (process.env.CORS_ALLOWED_ORIGINS) {
    const customOrigins = process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim());
    origins.push(...customOrigins);
  }

  return [...new Set(origins)]; // Remove duplicates
};

const allowedOrigins = getAllowedOrigins();

// Log allowed origins on startup (only in development)
if (process.env.NODE_ENV === 'development') {
  logger.info('CORS allowed origins:', { origins: allowedOrigins });
}

/**
 * CORS Configuration
 * Secure CORS setup with environment-specific origins
 */
export const corsConfig: FastifyCorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    // In development, allow all localhost origins
    if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
      logger.warn('CORS: Allowing localhost origin in development', { origin });
      callback(null, true);
      return;
    }

    // Reject with detailed error message
    logger.warn('CORS: Origin not allowed', {
      origin,
      allowedOrigins,
      environment: process.env.NODE_ENV,
    });
    callback(new Error(`Origin ${origin} is not allowed by CORS policy`), false);
  },

  // Allow credentials (cookies, auth headers)
  credentials: true,

  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],

  // Allowed request headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-CSRF-Token',
  ],

  // Exposed response headers (visible to frontend)
  exposedHeaders: [
    'X-Total-Count',
    'X-Page',
    'X-Per-Page',
    'X-Next-Cursor',
    'X-Has-More',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],

  // Preflight cache duration (in seconds)
  maxAge: process.env.NODE_ENV === 'production' ? 86400 : 600, // 24h in prod, 10m in dev

  // Disable preflight caching in development for faster iteration
  preflightContinue: false,

  // HTTP status code for successful OPTIONS request
  optionsSuccessStatus: 204,
} as const;

/**
 * Get the list of allowed origins (for documentation/debugging)
 */
export const getAllowedOriginsList = (): string[] => allowedOrigins;
