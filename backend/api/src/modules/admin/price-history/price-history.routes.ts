import { FastifyInstance } from 'fastify';
import { PriceHistoryController } from './price-history.controller.js';
import { PriceHistoryService } from './price-history.service.js';
import { PriceHistoryRepository } from './price-history.repository.js';
import { requireAuth } from '@/shared/auth/auth.middleware.js';

/**
 * Price History Routes
 * All routes require authentication
 */
export async function priceHistoryRoutes(fastify: FastifyInstance) {
  // Initialize repository, service, and controller
  const priceHistoryRepository = new PriceHistoryRepository();
  const priceHistoryService = new PriceHistoryService(priceHistoryRepository);
  const priceHistoryController = new PriceHistoryController(priceHistoryService);

  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', requireAuth);

  // Recent price changes (global)
  fastify.get('/api/v1/admin/price-history/recent', priceHistoryController.getRecentChanges);

  // Product-specific price history
  fastify.get(
    '/api/v1/admin/products/:productId/price-history',
    priceHistoryController.getByProductId
  );

  fastify.post(
    '/api/v1/admin/products/:productId/price-history',
    priceHistoryController.createPriceChange
  );

  // Product price statistics
  fastify.get(
    '/api/v1/admin/products/:productId/price-stats',
    priceHistoryController.getProductPriceStats
  );
}
