import { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { AdminProductController } from './admin-product.controller.js';
import { AdminProductService } from './admin-product.service.js';
import { AdminProductRepository } from './admin-product.repository.js';
import { requireAdmin } from '@/shared/auth/auth.middleware.js';

/**
 * Admin Product Routes
 * All routes require ADMIN role authentication
 */
export async function adminProductRoutes(fastify: FastifyInstance) {
  // Register multipart support for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
  });

  const repository = new AdminProductRepository();
  const service = new AdminProductService(repository);
  const controller = new AdminProductController(service);

  // All admin product routes require admin authentication
  const adminAuthHook = { preHandler: [requireAdmin] };

  /**
   * GET /api/v1/admin/products
   * List all products with filters (paginated)
   */
  fastify.get('/admin/products', {
    ...adminAuthHook,
    handler: controller.list,
  });

  /**
   * GET /api/v1/admin/products/:id
   * Get product details by ID
   */
  fastify.get('/admin/products/:id', {
    ...adminAuthHook,
    handler: controller.getById,
  });

  /**
   * POST /api/v1/admin/products
   * Create a new product
   */
  fastify.post('/admin/products', {
    ...adminAuthHook,
    handler: controller.create,
  });

  /**
   * PUT /api/v1/admin/products/:id
   * Update existing product
   */
  fastify.put('/admin/products/:id', {
    ...adminAuthHook,
    handler: controller.update,
  });

  /**
   * DELETE /api/v1/admin/products/:id
   * Soft delete product (sets status to DISCONTINUED)
   */
  fastify.delete('/admin/products/:id', {
    ...adminAuthHook,
    handler: controller.delete,
  });

  /**
   * DELETE /api/v1/admin/products/:id/hard
   * Permanently delete product (use with caution)
   */
  fastify.delete('/admin/products/:id/hard', {
    ...adminAuthHook,
    handler: controller.hardDelete,
  });

  /**
   * POST /api/v1/admin/products/import
   * Import products from CSV file
   * Expects multipart/form-data with file field
   */
  fastify.post('/admin/products/import', {
    ...adminAuthHook,
    handler: controller.importCSV,
  });
}
