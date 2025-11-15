import { FastifyInstance } from 'fastify';
import { ProductController } from './product.controller.js';
import { ProductService } from './product.service.js';
import { ProductRepository } from './product.repository.js';

export async function productRoutes(fastify: FastifyInstance) {
  const productRepository = new ProductRepository();
  const productService = new ProductService(productRepository);
  const productController = new ProductController(productService);

  // Public product endpoints
  fastify.get('/products', productController.list);
  fastify.get('/products/:slug', productController.getBySlug);
}
