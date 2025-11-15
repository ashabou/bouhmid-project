import {
  PriceHistoryRepository,
  CreatePriceChangeData,
} from './price-history.repository.js';
import { cacheService } from '@/shared/cache/cache.service.js';
import { NotFoundError, ValidationError } from '@/shared/errors/app.error.js';
import { logger } from '@/shared/logger/winston.config.js';
import { prisma } from '@/shared/database/client.js';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Price History Service
 * Business logic for price history management with cache invalidation
 */
export class PriceHistoryService {
  constructor(private priceHistoryRepository: PriceHistoryRepository) {}

  /**
   * Get price history for a product
   */
  async getByProductId(
    productId: string,
    options?: {
      page?: number;
      pageSize?: number;
    }
  ) {
    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        sku: true,
        currentPrice: true,
      },
    });

    if (!product) {
      throw new NotFoundError(`Product with ID ${productId} not found`);
    }

    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;
    const skip = (page - 1) * pageSize;

    const { data, total } = await this.priceHistoryRepository.findByProductId(
      productId,
      { limit: pageSize, skip }
    );

    // Get price statistics
    const stats = await this.priceHistoryRepository.getProductPriceStats(productId);

    return {
      product,
      history: data,
      stats,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Create manual price change
   */
  async createPriceChange(
    productId: string,
    newPrice: number,
    userId: string,
    reason?: string
  ) {
    // Verify product exists and get current price
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        sku: true,
        currentPrice: true,
        status: true,
      },
    });

    if (!product) {
      throw new NotFoundError(`Product with ID ${productId} not found`);
    }

    // Validate new price
    if (newPrice <= 0) {
      throw new ValidationError('Price must be greater than zero');
    }

    // Check if price actually changed
    const currentPrice = parseFloat(product.currentPrice.toString());
    if (currentPrice === newPrice) {
      throw new ValidationError(
        `New price (${newPrice}) is the same as current price`
      );
    }

    // Convert to Decimal for precision
    const newPriceDecimal = new Decimal(newPrice);
    const oldPriceDecimal = product.currentPrice;

    // Create price change data
    const priceChangeData: CreatePriceChangeData = {
      productId,
      oldPrice: oldPriceDecimal,
      newPrice: newPriceDecimal,
      changedBy: userId,
      reason,
    };

    // Create price change and update product
    const priceHistory = await this.priceHistoryRepository.createPriceChange(
      priceChangeData
    );

    // Invalidate product caches
    await this.invalidateProductCaches(productId, product.sku);

    // Calculate price change percentage
    const priceChangePercent =
      ((newPrice - currentPrice) / currentPrice) * 100;

    logger.info('Manual price change created', {
      productId,
      productName: product.name,
      oldPrice: currentPrice,
      newPrice,
      change: priceChangePercent.toFixed(2) + '%',
      userId,
      reason,
    });

    return {
      priceHistory,
      product: {
        ...product,
        currentPrice: newPriceDecimal,
      },
      priceChange: {
        oldPrice: currentPrice,
        newPrice,
        difference: newPrice - currentPrice,
        percentChange: priceChangePercent,
      },
    };
  }

  /**
   * Get recent price changes across all products
   */
  async getRecentChanges(limit = 20) {
    if (limit > 100) {
      throw new ValidationError('Limit cannot exceed 100');
    }

    const changes = await this.priceHistoryRepository.getRecentChanges(limit);

    return {
      data: changes,
      total: changes.length,
    };
  }

  /**
   * Get price statistics for a product
   */
  async getProductPriceStats(productId: string) {
    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        sku: true,
      },
    });

    if (!product) {
      throw new NotFoundError(`Product with ID ${productId} not found`);
    }

    const stats = await this.priceHistoryRepository.getProductPriceStats(productId);

    if (!stats) {
      return {
        product,
        stats: null,
        message: 'No price history available for this product',
      };
    }

    return {
      product,
      stats,
    };
  }

  /**
   * Invalidate product-related caches when price changes
   */
  private async invalidateProductCaches(productId: string, sku: string) {
    try {
      // Invalidate product detail caches
      await cacheService.invalidate(`product:*${productId}*`);
      await cacheService.invalidate(`product:*${sku}*`);

      // Invalidate product list caches
      await cacheService.invalidate('products:*');

      // Invalidate search caches (price affects search results)
      await cacheService.invalidate('search:*');

      logger.debug('Product caches invalidated after price change', {
        productId,
        sku,
      });
    } catch (error) {
      logger.error('Failed to invalidate product caches', {
        error,
        productId,
      });
      // Don't throw - cache invalidation failure should not block operations
    }
  }
}
