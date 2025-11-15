import { FastifyInstance } from 'fastify';
import { SearchController } from './search.controller.js';
import { SearchService } from './search.service.js';

export async function searchRoutes(fastify: FastifyInstance) {
  const searchService = new SearchService();
  const searchController = new SearchController(searchService);

  // Public search endpoints
  fastify.get('/search', searchController.search);
  fastify.get('/search/suggestions', searchController.suggestions);
  fastify.get('/search/filters', searchController.filters);
}
