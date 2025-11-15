import { FastifyRequest, FastifyReply } from 'fastify';
import { AdminBrandService } from './admin-brand.service.js';
import { z } from 'zod';
import { logger } from '@/shared/logger/winston.config.js';

// Validation schemas
const createBrandSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  logoUrl: z.string().url().max(500).optional(),
  description: z.string().optional(),
  countryOfOrigin: z.string().max(100).optional(),
  isActive: z.boolean().default(true).optional(),
});

const updateBrandSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  description: z.string().nullable().optional(),
  countryOfOrigin: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
});

const listBrandsSchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

const brandIdSchema = z.object({
  id: z.coerce.number().int().positive('Invalid brand ID'),
});

/**
 * Admin Brand Controller
 * Handles HTTP requests for admin brand management
 */
export class AdminBrandController {
  constructor(private brandService: AdminBrandService) {}

  /**
   * POST /api/v1/admin/brands
   * Create a new brand
   */
  create = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const data = createBrandSchema.parse(request.body);

      const brand = await this.brandService.create(data);

      return reply.code(201).send({
        success: true,
        data: brand,
      });
    } catch (error) {
      logger.error('Failed to create brand', { error });
      throw error;
    }
  };

  /**
   * PUT /api/v1/admin/brands/:id
   * Update existing brand
   */
  update = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { id } = brandIdSchema.parse(request.params);
      const data = updateBrandSchema.parse(request.body);

      const brand = await this.brandService.update(id, data);

      return reply.send({
        success: true,
        data: brand,
      });
    } catch (error) {
      logger.error('Failed to update brand', { error });
      throw error;
    }
  };

  /**
   * DELETE /api/v1/admin/brands/:id
   * Soft delete brand (sets isActive to false)
   */
  delete = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { id } = brandIdSchema.parse(request.params);

      const result = await this.brandService.delete(id);

      return reply.send(result);
    } catch (error) {
      logger.error('Failed to delete brand', { error });
      throw error;
    }
  };

  /**
   * DELETE /api/v1/admin/brands/:id/hard
   * Permanently delete brand (admin only - use with caution)
   */
  hardDelete = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const { id } = brandIdSchema.parse(request.params);

      const result = await this.brandService.hardDelete(id);

      return reply.send(result);
    } catch (error) {
      logger.error('Failed to hard delete brand', { error });
      throw error;
    }
  };

  /**
   * GET /api/v1/admin/brands/:id
   * Get brand details
   */
  getById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = brandIdSchema.parse(request.params);

      const brand = await this.brandService.getById(id);

      return reply.send({
        data: brand,
      });
    } catch (error) {
      logger.error('Failed to get brand', { error });
      throw error;
    }
  };

  /**
   * GET /api/v1/admin/brands
   * List all brands with filters
   */
  list = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const filters = listBrandsSchema.parse(request.query);

      const result = await this.brandService.list(filters);

      return reply.send(result);
    } catch (error) {
      logger.error('Failed to list brands', { error });
      throw error;
    }
  };
}
