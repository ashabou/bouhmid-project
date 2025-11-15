import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { appConfig } from './config/app.config.js';
import { corsConfig } from './config/cors.config.js';
import { jwtConfig } from './config/jwt.config.js';
import { swaggerOptions, swaggerUiOptions } from './config/swagger.config.js';
import { errorHandler } from './shared/errors/error.handler.js';
import { logger } from './shared/logger/winston.config.js';

// Import routes
import { productRoutes } from './modules/products/product.routes.js';
import { brandRoutes } from './modules/brands/brand.routes.js';
import { categoryRoutes } from './modules/categories/category.routes.js';
import { searchRoutes } from './modules/search/search.routes.js';
import { authRoutes } from './modules/admin/auth/auth.routes.js';
import { adminProductRoutes } from './modules/admin/products/admin-product.routes.js';
import { adminBrandRoutes } from './modules/admin/brands/admin-brand.routes.js';
import { adminCategoryRoutes } from './modules/admin/categories/admin-category.routes.js';
import { priceHistoryRoutes } from './modules/admin/price-history/price-history.routes.js';
import { dashboardRoutes } from './modules/admin/dashboard/dashboard.routes.js';
import { leadRoutes } from './modules/admin/leads/lead.routes.js';

/**
 * Create and configure Fastify application
 */
export async function createApp() {
  const app = Fastify({
    logger: false, // Using Winston instead
    trustProxy: true,
    disableRequestLogging: false,
  });

  // Register plugins
  await app.register(cors, corsConfig);

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  await app.register(compress, {
    threshold: 1024, // Only compress responses > 1KB
    encodings: ['gzip', 'deflate'],
  });

  await app.register(cookie, {
    secret: jwtConfig.secret,
    parseOptions: {},
  });

  // Swagger/OpenAPI documentation
  await app.register(swagger, swaggerOptions);
  await app.register(swaggerUi, swaggerUiOptions);

  // Rate limiting
  await app.register(rateLimit, {
    max: appConfig.rateLimit.max,
    timeWindow: appConfig.rateLimit.timeWindow,
    cache: 10000,
    allowList: ['127.0.0.1'],
    redis: undefined, // Will be configured with Redis later
    keyGenerator: (request) => {
      return request.ip;
    },
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    }),
  });

  // Global error handler
  app.setErrorHandler(errorHandler);

  // Request logging
  app.addHook('onRequest', async (request) => {
    logger.info(`${request.method} ${request.url}`, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
  });

  // Response logging
  app.addHook('onResponse', async (request, reply) => {
    logger.info(`${request.method} ${request.url} - ${reply.statusCode}`, {
      responseTime: reply.elapsedTime,
    });
  });

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: appConfig.nodeEnv,
    };
  });

  // API info endpoint
  app.get('/', async () => {
    return {
      name: 'Shabou Auto Pièces API',
      version: appConfig.api.version,
      environment: appConfig.nodeEnv,
      documentation: '/docs',
      openapi: '/openapi.json',
    };
  });

  // OpenAPI spec endpoint (for frontend integration)
  app.get('/openapi.json', async (_request, reply) => {
    reply.header('Content-Type', 'application/json');
    return app.swagger();
  });

  // Register routes
  await app.register(productRoutes, { prefix: appConfig.api.prefix });
  await app.register(brandRoutes, { prefix: appConfig.api.prefix });
  await app.register(categoryRoutes, { prefix: appConfig.api.prefix });
  await app.register(searchRoutes, { prefix: appConfig.api.prefix });
  await app.register(authRoutes, { prefix: appConfig.api.prefix });
  await app.register(adminProductRoutes, { prefix: appConfig.api.prefix });
  await app.register(adminBrandRoutes, { prefix: appConfig.api.prefix });
  await app.register(adminCategoryRoutes, { prefix: appConfig.api.prefix });
  await app.register(priceHistoryRoutes, { prefix: appConfig.api.prefix });
  await app.register(dashboardRoutes, { prefix: appConfig.api.prefix });
  await app.register(leadRoutes, { prefix: appConfig.api.prefix });

  return app;
}
