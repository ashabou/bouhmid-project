import { FastifyRequest, FastifyReply } from 'fastify';
import { AdminCategoryService } from './admin-category.service.js';
import { z } from 'zod';

/**
 * Validation Schemas
 */
const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(500).optional(),
  parentId: z.number().int().positive().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  description: z.string().max(500).optional().nullable(),
  parentId: z.number().int().positive().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const listCategoriesSchema = z.object({
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  level: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  parentId: z
    .string()
    .optional()
    .transform((val) => {
      if (val === 'null') return null;
      if (val === undefined) return undefined;
      return parseInt(val, 10);
    }),
  search: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  pageSize: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20)),
});

const reorderCategoriesSchema = z.object({
  categoryIds: z.array(z.number().int().positive()).min(1, 'At least one category ID required'),
});

/**
 * Admin Category Controller
 */
export class AdminCategoryController {
  constructor(private categoryService: AdminCategoryService) {}

  /**
   * Create a new category
   * POST /api/v1/admin/categories
   */
  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createCategorySchema.parse(request.body);

    const category = await this.categoryService.create({
      name: data.name,
      slug: data.slug,
      description: data.description,
      parentId: data.parentId ?? undefined,
      level: 0, // Will be calculated in service
      sortOrder: data.sortOrder,
      isActive: data.isActive,
    });

    return reply.status(201).send({
      success: true,
      data: category,
    });
  };

  /**
   * Update existing category
   * PUT /api/v1/admin/categories/:id
   */
  update = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const id = parseInt(request.params.id, 10);
    const data = updateCategorySchema.parse(request.body);

    const category = await this.categoryService.update(id, data);

    return reply.send({
      success: true,
      data: category,
    });
  };

  /**
   * Delete category (soft delete)
   * DELETE /api/v1/admin/categories/:id
   */
  delete = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const id = parseInt(request.params.id, 10);

    const result = await this.categoryService.delete(id);

    return reply.send(result);
  };

  /**
   * Hard delete category (permanent)
   * DELETE /api/v1/admin/categories/:id/hard
   */
  hardDelete = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const id = parseInt(request.params.id, 10);

    const result = await this.categoryService.hardDelete(id);

    return reply.send(result);
  };

  /**
   * Get category by ID
   * GET /api/v1/admin/categories/:id
   */
  getById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const id = parseInt(request.params.id, 10);

    const category = await this.categoryService.getById(id);

    return reply.send({
      success: true,
      data: category,
    });
  };

  /**
   * List categories with filters
   * GET /api/v1/admin/categories
   */
  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listCategoriesSchema.parse(request.query);

    const result = await this.categoryService.list(query);

    return reply.send({
      success: true,
      ...result,
    });
  };

  /**
   * Get complete category tree
   * GET /api/v1/admin/categories/tree
   */
  getTree = async (_request: FastifyRequest, reply: FastifyReply) => {
    const tree = await this.categoryService.getTree();

    return reply.send({
      success: true,
      data: tree,
    });
  };

  /**
   * Reorder categories
   * POST /api/v1/admin/categories/reorder
   */
  reorder = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = reorderCategoriesSchema.parse(request.body);

    const result = await this.categoryService.reorder(data.categoryIds);

    return reply.send(result);
  };
}
