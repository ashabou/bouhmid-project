import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
const envFile = process.env.NODE_ENV === 'production'
  ? '.env.production'
  : '.env.development';

config({ path: resolve(process.cwd(), envFile) });

export const appConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiUrl: process.env.API_URL || 'http://localhost:3000',

  // API Configuration
  api: {
    prefix: '/api/v1',
    version: '1.0.0',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Rate Limiting
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: parseInt(process.env.RATE_LIMIT_TIMEWINDOW || '60000', 10),
  },

  // Agent Services
  agents: {
    prospector: process.env.PROSPECTOR_URL || 'http://localhost:8001',
    orion: process.env.ORION_URL || 'http://localhost:8002',
  },
} as const;

export const isDevelopment = appConfig.nodeEnv === 'development';
export const isProduction = appConfig.nodeEnv === 'production';
export const isTest = appConfig.nodeEnv === 'test';
