import { FastifyInstance } from 'fastify';
import { AdminCategoryController } from './admin-category.controller.js';
import { AdminCategoryService } from './admin-category.service.js';
import { AdminCategoryRepository } from './admin-category.repository.js';
import { requireAuth } from '@/shared/auth/auth.middleware.js';

/**
 * Admin Category Routes
 * All routes require authentication
 */
export async function adminCategoryRoutes(fastify: FastifyInstance) {
  // Initialize repository, service, and controller
  const categoryRepository = new AdminCategoryRepository();
  const categoryService = new AdminCategoryService(categoryRepository);
  const categoryController = new AdminCategoryController(categoryService);

  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', requireAuth);

  // Category CRUD endpoints
  fastify.post('/api/v1/admin/categories', categoryController.create);
  fastify.get('/api/v1/admin/categories', categoryController.list);
  fastify.get('/api/v1/admin/categories/tree', categoryController.getTree);
  fastify.get('/api/v1/admin/categories/:id', categoryController.getById);
  fastify.put('/api/v1/admin/categories/:id', categoryController.update);
  fastify.delete('/api/v1/admin/categories/:id', categoryController.delete);
  fastify.delete('/api/v1/admin/categories/:id/hard', categoryController.hardDelete);

  // Reorder categories
  fastify.post('/api/v1/admin/categories/reorder', categoryController.reorder);
}
