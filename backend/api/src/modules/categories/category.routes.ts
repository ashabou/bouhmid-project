import { FastifyInstance } from 'fastify';
import { CategoryController } from './category.controller.js';
import { CategoryService } from './category.service.js';
import { CategoryRepository } from './category.repository.js';

export async function categoryRoutes(fastify: FastifyInstance) {
  const categoryRepository = new CategoryRepository();
  const categoryService = new CategoryService(categoryRepository);
  const categoryController = new CategoryController(categoryService);

  // Public category endpoints
  fastify.get('/categories', categoryController.list);
  fastify.get('/categories/tree', categoryController.getTree);
  fastify.get('/categories/:slug', categoryController.getBySlug);
}
