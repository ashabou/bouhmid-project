import { FastifyRequest, FastifyReply } from 'fastify';
import { PriceHistoryService } from './price-history.service.js';
import { z } from 'zod';

/**
 * Validation Schemas
 */
const createPriceChangeSchema = z.object({
  newPrice: z
    .number()
    .positive('Price must be greater than zero')
    .finite('Price must be a valid number'),
  reason: z.string().max(255, 'Reason cannot exceed 255 characters').optional(),
});

const getPriceHistorySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  pageSize: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(parseInt(val, 10), 100) : 50)),
});

const getRecentChangesSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(parseInt(val, 10), 100) : 20)),
});

/**
 * Price History Controller
 */
export class PriceHistoryController {
  constructor(private priceHistoryService: PriceHistoryService) {}

  /**
   * Get price history for a product
   * GET /api/v1/admin/products/:productId/price-history
   */
  getByProductId = async (
    request: FastifyRequest<{ Params: { productId: string } }>,
    reply: FastifyReply
  ) => {
    const { productId } = request.params;
    const query = getPriceHistorySchema.parse(request.query);

    const result = await this.priceHistoryService.getByProductId(productId, {
      page: query.page,
      pageSize: query.pageSize,
    });

    return reply.send({
      success: true,
      ...result,
    });
  };

  /**
   * Create manual price change
   * POST /api/v1/admin/products/:productId/price-history
   */
  createPriceChange = async (
    request: FastifyRequest<{ Params: { productId: string } }>,
    reply: FastifyReply
  ) => {
    const { productId } = request.params;
    const data = createPriceChangeSchema.parse(request.body);

    // Get user ID from authenticated request
    // @ts-ignore - user is set by auth middleware
    const userId = request.user?.id;

    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: 'User not authenticated',
      });
    }

    const result = await this.priceHistoryService.createPriceChange(
      productId,
      data.newPrice,
      userId,
      data.reason
    );

    return reply.status(201).send({
      success: true,
      message: 'Price updated successfully',
      data: result,
    });
  };

  /**
   * Get recent price changes across all products
   * GET /api/v1/admin/price-history/recent
   */
  getRecentChanges = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = getRecentChangesSchema.parse(request.query);

    const result = await this.priceHistoryService.getRecentChanges(query.limit);

    return reply.send({
      success: true,
      ...result,
    });
  };

  /**
   * Get price statistics for a product
   * GET /api/v1/admin/products/:productId/price-stats
   */
  getProductPriceStats = async (
    request: FastifyRequest<{ Params: { productId: string } }>,
    reply: FastifyReply
  ) => {
    const { productId } = request.params;

    const result = await this.priceHistoryService.getProductPriceStats(productId);

    return reply.send({
      success: true,
      ...result,
    });
  };
}
