import { FastifyRequest, FastifyReply } from 'fastify';
import { AdminProductService } from './admin-product.service.js';
import { CSVImportService } from './csv-import.service.js';
import { z } from 'zod';
import { logger } from '@/shared/logger/winston.config.js';
import { BadRequestError } from '@/shared/errors/app.error.js';

// Validation schemas
const createProductSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(500),
  slug: z.string().min(1).max(500).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  brandId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive(),
  description: z.string().optional(),
  specifications: z.any().optional(), // JSON object
  currentPrice: z.number().positive(),
  originalPrice: z.number().positive().optional(),
  currency: z.string().length(3).default('TND').optional(),
  inStock: z.boolean().default(true).optional(),
  stockQuantity: z.number().int().min(0).default(0).optional(),
  images: z.any().optional(), // JSON array
  primaryImageUrl: z.string().url().max(500).optional(),
  metaTitle: z.string().max(255).optional(),
  metaDescription: z.string().max(500).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK']).default('ACTIVE').optional(),
  compatibleVehicles: z.any().optional(), // JSON array
  partNumber: z.string().max(100).optional(),
});

const updateProductSchema = z.object({
  sku: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(500).optional(),
  slug: z.string().min(1).max(500).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens').optional(),
  brandId: z.number().int().positive().nullable().optional(),
  categoryId: z.number().int().positive().optional(),
  description: z.string().nullable().optional(),
  specifications: z.any().nullable().optional(),
  currentPrice: z.number().positive().optional(),
  originalPrice: z.number().positive().nullable().optional(),
  currency: z.string().length(3).optional(),
  inStock: z.boolean().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  images: z.any().nullable().optional(),
  primaryImageUrl: z.string().url().max(500).nullable().optional(),
  metaTitle: z.string().max(255).nullable().optional(),
  metaDescription: z.string().max(500).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK']).optional(),
  compatibleVehicles: z.any().nullable().optional(),
  partNumber: z.string().max(100).nullable().optional(),
});

const listProductsSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK']).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  inStock: z.enum(['true', 'false']).optional().transform((val) => val === 'true'),
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

const productIdSchema = z.object({
  id: z.string().uuid('Invalid product ID format'),
});

/**
 * Admin Product Controller
 * Handles HTTP requests for admin product management
 */
export class AdminProductController {
  private csvImportService: CSVImportService;

  constructor(private productService: AdminProductService) {
    this.csvImportService = new CSVImportService();
  }

  /**
   * POST /api/v1/admin/products
   * Create a new product
   */
  create = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const data = createProductSchema.parse(request.body);

      const product = await this.productService.create(data, request.user.userId);

      return reply.code(201).send({
        success: true,
        data: product,
      });
    } catch (error) {
      logger.error('Failed to create product', { error });
      throw error;
    }
  };

  /**
   * PUT /api/v1/admin/products/:id
   * Update existing product
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

      const { id } = productIdSchema.parse(request.params);
      const data = updateProductSchema.parse(request.body);

      const product = await this.productService.update(id, data, request.user.userId);

      return reply.send({
        success: true,
        data: product,
      });
    } catch (error) {
      logger.error('Failed to update product', { error });
      throw error;
    }
  };

  /**
   * DELETE /api/v1/admin/products/:id
   * Soft delete product (sets status to DISCONTINUED)
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

      const { id } = productIdSchema.parse(request.params);

      const result = await this.productService.delete(id, request.user.userId);

      return reply.send(result);
    } catch (error) {
      logger.error('Failed to delete product', { error });
      throw error;
    }
  };

  /**
   * DELETE /api/v1/admin/products/:id/hard
   * Permanently delete product (admin only - use with caution)
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

      const { id } = productIdSchema.parse(request.params);

      const result = await this.productService.hardDelete(id, request.user.userId);

      return reply.send(result);
    } catch (error) {
      logger.error('Failed to hard delete product', { error });
      throw error;
    }
  };

  /**
   * GET /api/v1/admin/products/:id
   * Get product details
   */
  getById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { id } = productIdSchema.parse(request.params);

      const product = await this.productService.getById(id);

      return reply.send({
        data: product,
      });
    } catch (error) {
      logger.error('Failed to get product', { error });
      throw error;
    }
  };

  /**
   * GET /api/v1/admin/products
   * List all products with filters
   */
  list = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const filters = listProductsSchema.parse(request.query);

      const result = await this.productService.list(filters);

      return reply.send(result);
    } catch (error) {
      logger.error('Failed to list products', { error });
      throw error;
    }
  };

  /**
   * POST /api/v1/admin/products/import
   * Import products from CSV file
   */
  importCSV = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // Get uploaded file
      const data = await request.file();

      if (!data) {
        throw new BadRequestError('No file uploaded');
      }

      // Validate file type
      const allowedMimeTypes = ['text/csv', 'application/csv', 'text/plain'];
      if (!allowedMimeTypes.includes(data.mimetype)) {
        throw new BadRequestError(
          `Invalid file type. Expected CSV file, got ${data.mimetype}`
        );
      }

      // Read file buffer
      const fileBuffer = await data.toBuffer();

      // Validate file size (max 10MB)
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (fileBuffer.length > MAX_FILE_SIZE) {
        throw new BadRequestError(
          `File too large. Maximum size is 10MB, got ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`
        );
      }

      logger.info('CSV import started', {
        userId: request.user.userId,
        filename: data.filename,
        size: fileBuffer.length,
      });

      // Import products
      const result = await this.csvImportService.importProducts(
        fileBuffer,
        request.user.userId
      );

      // Invalidate product caches after successful import
      if (result.imported > 0) {
        const { cacheService } = await import('@/shared/cache/cache.service.js');
        await cacheService.invalidatePattern('products:*');
        await cacheService.invalidatePattern('search:*');
        logger.info('Product caches invalidated after CSV import');
      }

      return reply.send(result);
    } catch (error) {
      logger.error('CSV import failed', { error });
      throw error;
    }
  };
}
