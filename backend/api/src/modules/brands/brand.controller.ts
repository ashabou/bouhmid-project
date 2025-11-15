import { FastifyRequest, FastifyReply } from 'fastify';
import { BrandService } from './brand.service.js';
import { z } from 'zod';

// Validation schema for brand list query
const listBrandsSchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export class BrandController {
  constructor(private brandService: BrandService) {}

  /**
   * List all brands
   * GET /api/v1/brands
   */
  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const { isActive } = listBrandsSchema.parse(request.query);

    const result = await this.brandService.list(isActive);

    return reply.send(result);
  };

  /**
   * Get brand by slug
   * GET /api/v1/brands/:slug
   */
  getBySlug = async (
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply
  ) => {
    const { slug } = request.params;
    const brand = await this.brandService.getBySlug(slug);
    return reply.send({ data: brand });
  };
}
