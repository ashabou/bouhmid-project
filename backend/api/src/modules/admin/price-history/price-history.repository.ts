import { prisma } from '@/shared/database/client.js';
import { logger } from '@/shared/logger/winston.config.js';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreatePriceChangeData {
  productId: string;
  oldPrice: Decimal | null;
  newPrice: Decimal;
  changedBy: string;
  reason?: string;
}

/**
 * Price History Repository
 * Handles price history queries and manual price changes
 */
export class PriceHistoryRepository {
  /**
   * Get price history for a product
   */
  async findByProductId(
    productId: string,
    options?: {
      limit?: number;
      skip?: number;
    }
  ) {
    const limit = options?.limit || 50;
    const skip = options?.skip || 0;

    const [history, total] = await Promise.all([
      prisma.priceHistory.findMany({
        where: { productId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      }),
      prisma.priceHistory.count({ where: { productId } }),
    ]);

    return { data: history, total };
  }

  /**
   * Get latest price history entry for a product
   */
  async findLatestByProductId(productId: string) {
    return prisma.priceHistory.findFirst({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Create a price change record and update product price
   */
  async createPriceChange(data: CreatePriceChangeData) {
    try {
      // Use transaction to ensure atomic operation
      const result = await prisma.$transaction(async (tx: any) => {
        // Create price history entry
        const priceHistory = await tx.priceHistory.create({
          data: {
            productId: data.productId,
            oldPrice: data.oldPrice,
            newPrice: data.newPrice,
            changedBy: data.changedBy,
            reason: data.reason || null,
          },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                currentPrice: true,
              },
            },
          },
        });

        // Update product's current price
        await tx.product.update({
          where: { id: data.productId },
          data: {
            currentPrice: data.newPrice,
          },
        });

        return priceHistory;
      });

      logger.info('Price change created', {
        productId: data.productId,
        oldPrice: data.oldPrice?.toString(),
        newPrice: data.newPrice.toString(),
        changedBy: data.changedBy,
      });

      return result;
    } catch (error) {
      logger.error('Failed to create price change', { error, data });
      throw error;
    }
  }

  /**
   * Get price change statistics for a product
   */
  async getProductPriceStats(productId: string) {
    const history = await prisma.priceHistory.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      select: {
        newPrice: true,
        createdAt: true,
      },
    });

    if (history.length === 0) {
      return null;
    }

    const prices = history.map((h: any) => parseFloat(h.newPrice.toString()));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length;
    const currentPrice = parseFloat(history[0].newPrice.toString());

    return {
      currentPrice,
      minPrice,
      maxPrice,
      avgPrice,
      totalChanges: history.length,
      firstRecorded: history[history.length - 1].createdAt,
      lastChanged: history[0].createdAt,
    };
  }

  /**
   * Get price history for multiple products
   */
  async findByProductIds(productIds: string[]) {
    return prisma.priceHistory.findMany({
      where: {
        productId: { in: productIds },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });
  }

  /**
   * Get recent price changes across all products
   */
  async getRecentChanges(limit = 20) {
    return prisma.priceHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            slug: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });
  }
}
