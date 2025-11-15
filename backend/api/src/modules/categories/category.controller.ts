import { FastifyRequest, FastifyReply } from 'fastify';
import { CategoryService } from './category.service.js';
import { z } from 'zod';

// Validation schema for category list query
const listCategoriesSchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
  level: z.coerce.number().int().min(0).max(3).optional(),
});

export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  /**
   * List all categories (flat)
   * GET /api/v1/categories
   */
  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const { isActive, level } = listCategoriesSchema.parse(request.query);

    const result = await this.categoryService.list(isActive, level);

    return reply.send(result);
  };

  /**
   * Get category tree (hierarchical)
   * GET /api/v1/categories/tree
   */
  getTree = async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await this.categoryService.getTree();

    return reply.send(result);
  };

  /**
   * Get category by slug
   * GET /api/v1/categories/:slug
   */
  getBySlug = async (
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply
  ) => {
    const { slug } = request.params;
    const category = await this.categoryService.getBySlug(slug);
    return reply.send({ data: category });
  };
}
