import { createApp } from './app.js';
import { appConfig } from './config/app.config.js';
import { logger } from './shared/logger/winston.config.js';

/**
 * Start the server
 */
async function start() {
  try {
    const app = await createApp();

    await app.listen({
      port: appConfig.port,
      host: '0.0.0.0',
    });

    logger.info(`🚀 Server running on http://localhost:${appConfig.port}`);
    logger.info(`📚 Environment: ${appConfig.nodeEnv}`);
    logger.info(`🔍 Health check: http://localhost:${appConfig.port}/health`);
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];

signals.forEach((signal) => {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    process.exit(0);
  });
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  process.exit(1);
});

start();
