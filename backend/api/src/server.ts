import { createApp } from './app.js';
import { appConfig } from './config/app.config.js';
import { logger } from './shared/logger/winston.config.js';
import { prisma } from './shared/database/client.js';
import { redisClient } from './shared/cache/redis.client.js';
import type { FastifyInstance } from 'fastify';

// Store app instance for graceful shutdown
let app: FastifyInstance | null = null;

/**
 * Start the server
 */
async function start() {
  try {
    app = await createApp();

    await app.listen({
      port: appConfig.port,
      host: '0.0.0.0',
    });

    logger.info(`🚀 Server running on http://localhost:${appConfig.port}`);
    logger.info(`📚 Environment: ${appConfig.nodeEnv}`);
    logger.info(`🔍 Health check: http://localhost:${appConfig.port}/api/v1/health`);
    logger.info(`📖 API Docs: http://localhost:${appConfig.port}/docs`);
  } catch (error) {
    logger.error('Failed to start server', { error });
    await cleanup();
    process.exit(1);
  }
}

/**
 * Cleanup resources
 */
async function cleanup() {
  logger.info('Cleaning up resources...');

  const cleanupPromises: Promise<void>[] = [];

  // Close Fastify server
  if (app) {
    cleanupPromises.push(
      app.close().then(() => {
        logger.info('✅ Fastify server closed');
      }).catch((err) => {
        logger.error('❌ Error closing Fastify server', { error: err });
      })
    );
  }

  // Close Prisma connection
  cleanupPromises.push(
    prisma.$disconnect().then(() => {
      logger.info('✅ Database connection closed');
    }).catch((err) => {
      logger.error('❌ Error closing database connection', { error: err });
    })
  );

  // Close Redis connection
  cleanupPromises.push(
    redisClient.quit().then(() => {
      logger.info('✅ Redis connection closed');
    }).catch((err) => {
      logger.error('❌ Error closing Redis connection', { error: err });
    })
  );

  // Wait for all cleanup operations with timeout
  await Promise.race([
    Promise.all(cleanupPromises),
    new Promise((resolve) => setTimeout(resolve, 10000)), // 10s timeout
  ]);

  logger.info('✅ Cleanup completed');
}

/**
 * Handle graceful shutdown
 */
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  try {
    await cleanup();
    logger.info('👋 Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error });
    process.exit(1);
  }
}

// Handle shutdown signals
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

signals.forEach((signal) => {
  process.on(signal, () => gracefulShutdown(signal));
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  // Don't exit immediately - log and continue
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught Exception', { error });
  await cleanup();
  process.exit(1);
});

// Start the server
start();
