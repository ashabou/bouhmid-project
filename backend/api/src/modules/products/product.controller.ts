import { FastifyRequest, FastifyReply } from 'fastify';
import { ProductService } from './product.service.js';
import { listProductsSchema } from '@/shared/validation/schemas.js';
import { parseProductFilters } from '@/shared/utils/filtering.js';
import { parseSortParams } from '@/shared/utils/sorting.js';
import { parsePaginationParams } from '@/shared/utils/pagination.js';

export class ProductController {
  constructor(private productService: ProductService) {}

  /**
   * List products with filters, sorting, and pagination
   * GET /api/v1/products
   */
  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listProductsSchema.parse(request.query);

    const { cursor, limit, sortBy, sortOrder, ...filterParams } = query;

    const filters = parseProductFilters(filterParams);
    const sort = parseSortParams({ sortBy, sortOrder });
    const pagination = parsePaginationParams({ cursor, limit });

    const result = await this.productService.list(filters, sort, pagination);

    return reply.send(result);
  };

  /**
   * Get product by slug
   * GET /api/v1/products/:slug
   */
  getBySlug = async (
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply
  ) => {
    const { slug } = request.params;
    const product = await this.productService.getBySlug(slug);
    return reply.send({ data: product });
  };
}
