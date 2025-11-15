import { FastifyInstance } from 'fastify';
import { AdminBrandController } from './admin-brand.controller.js';
import { AdminBrandService } from './admin-brand.service.js';
import { AdminBrandRepository } from './admin-brand.repository.js';
import { requireAdmin } from '@/shared/auth/auth.middleware.js';

/**
 * Admin Brand Routes
 * All routes require ADMIN role authentication
 */
export async function adminBrandRoutes(fastify: FastifyInstance) {
  const repository = new AdminBrandRepository();
  const service = new AdminBrandService(repository);
  const controller = new AdminBrandController(service);

  // All admin brand routes require admin authentication
  const adminAuthHook = { preHandler: [requireAdmin] };

  /**
   * GET /api/v1/admin/brands
   * List all brands with filters (paginated)
   */
  fastify.get('/admin/brands', {
    ...adminAuthHook,
    handler: controller.list,
  });

  /**
   * GET /api/v1/admin/brands/:id
   * Get brand details by ID
   */
  fastify.get('/admin/brands/:id', {
    ...adminAuthHook,
    handler: controller.getById,
  });

  /**
   * POST /api/v1/admin/brands
   * Create a new brand
   */
  fastify.post('/admin/brands', {
    ...adminAuthHook,
    handler: controller.create,
  });

  /**
   * PUT /api/v1/admin/brands/:id
   * Update existing brand
   */
  fastify.put('/admin/brands/:id', {
    ...adminAuthHook,
    handler: controller.update,
  });

  /**
   * DELETE /api/v1/admin/brands/:id
   * Soft delete brand (sets isActive to false)
   */
  fastify.delete('/admin/brands/:id', {
    ...adminAuthHook,
    handler: controller.delete,
  });

  /**
   * DELETE /api/v1/admin/brands/:id/hard
   * Permanently delete brand (use with caution)
   */
  fastify.delete('/admin/brands/:id/hard', {
    ...adminAuthHook,
    handler: controller.hardDelete,
  });
}
