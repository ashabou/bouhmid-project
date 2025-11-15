import { FastifyInstance } from 'fastify';
import { BrandController } from './brand.controller.js';
import { BrandService } from './brand.service.js';
import { BrandRepository } from './brand.repository.js';

export async function brandRoutes(fastify: FastifyInstance) {
  const brandRepository = new BrandRepository();
  const brandService = new BrandService(brandRepository);
  const brandController = new BrandController(brandService);

  // Public brand endpoints
  fastify.get('/brands', brandController.list);
  fastify.get('/brands/:slug', brandController.getBySlug);
}
