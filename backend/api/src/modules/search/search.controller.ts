import { FastifyRequest, FastifyReply } from 'fastify';
import { SearchService } from './search.service.js';
import { z } from 'zod';
import { parsePaginationParams } from '@/shared/utils/pagination.js';

// Validation schema for search query
const searchSchema = z.object({
  q: z.string().min(1).max(100),
  categoryId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  inStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Validation schema for suggestions
const suggestionsSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

// Validation schema for filter aggregations
const filterAggregationsSchema = z.object({
  q: z.string().min(1).max(100),
  categoryId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
});

export class SearchController {
  constructor(private searchService: SearchService) {}

  /**
   * Search products
   * GET /api/v1/search
   */
  search = async (request: FastifyRequest, reply: FastifyReply) => {
    const { q, categoryId, brandId, minPrice, maxPrice, inStock, cursor, limit } =
      searchSchema.parse(request.query);

    const pagination = parsePaginationParams({ cursor, limit });

    const result = await this.searchService.search(
      {
        query: q,
        categoryId,
        brandId,
        minPrice,
        maxPrice,
        inStock,
      },
      pagination
    );

    return reply.send(result);
  };

  /**
   * Get search suggestions (autocomplete)
   * GET /api/v1/search/suggestions
   */
  suggestions = async (request: FastifyRequest, reply: FastifyReply) => {
    const { q, limit } = suggestionsSchema.parse(request.query);

    const result = await this.searchService.getSuggestions(q, limit);

    return reply.send(result);
  };

  /**
   * Get filter aggregations for search results
   * GET /api/v1/search/filters
   */
  filters = async (request: FastifyRequest, reply: FastifyReply) => {
    const { q, categoryId, brandId } = filterAggregationsSchema.parse(request.query);

    const result = await this.searchService.getFilterAggregations({
      query: q,
      categoryId,
      brandId,
    });

    return reply.send(result);
  };
}
