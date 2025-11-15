import { prisma } from '@/shared/database/client.js';
import { logger } from '@/shared/logger/winston.config.js';

/**
 * Dashboard Repository
 * Handles data aggregation and statistics queries for admin dashboard
 */
export class DashboardRepository {
  /**
   * Get total counts for all main entities
   */
  async getTotalCounts() {
    try {
      const [
        totalProducts,
        activeProducts,
        totalCategories,
        activeCategories,
        totalBrands,
        activeBrands,
        totalLeads,
        newLeads,
      ] = await Promise.all([
        prisma.product.count(),
        prisma.product.count({ where: { status: 'ACTIVE' } }),
        prisma.category.count(),
        prisma.category.count({ where: { isActive: true } }),
        prisma.brand.count(),
        prisma.brand.count({ where: { isActive: true } }),
        prisma.lead.count(),
        prisma.lead.count({ where: { status: 'NEW' } }),
      ]);

      return {
        products: {
          total: totalProducts,
          active: activeProducts,
          inactive: totalProducts - activeProducts,
        },
        categories: {
          total: totalCategories,
          active: activeCategories,
          inactive: totalCategories - activeCategories,
        },
        brands: {
          total: totalBrands,
          active: activeBrands,
          inactive: totalBrands - activeBrands,
        },
        leads: {
          total: totalLeads,
          new: newLeads,
        },
      };
    } catch (error) {
      logger.error('Failed to get total counts', { error });
      throw error;
    }
  }

  /**
   * Get product status breakdown
   */
  async getProductStatusBreakdown() {
    try {
      const statusCounts = await prisma.product.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
      });

      return statusCounts.map((item: any) => ({
        status: item.status,
        count: item._count.status,
      }));
    } catch (error) {
      logger.error('Failed to get product status breakdown', { error });
      throw error;
    }
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts(threshold = 10, limit = 10) {
    try {
      return prisma.product.findMany({
        where: {
          stockQuantity: {
            lte: threshold,
          },
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          sku: true,
          slug: true,
          stockQuantity: true,
          inStock: true,
          brand: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          stockQuantity: 'asc',
        },
        take: limit,
      });
    } catch (error) {
      logger.error('Failed to get low stock products', { error });
      throw error;
    }
  }

  /**
   * Get recent activity (price changes, product updates)
   */
  async getRecentActivity(limit = 20) {
    try {
      // Get recent price changes
      const recentPriceChanges = await prisma.priceHistory.findMany({
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
            },
          },
        },
      });

      // Get recently created products
      const recentProducts = await prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.floor(limit / 2),
        select: {
          id: true,
          name: true,
          sku: true,
          slug: true,
          createdAt: true,
          brand: {
            select: {
              name: true,
            },
          },
        },
      });

      // Get recently updated products
      const recentUpdates = await prisma.product.findMany({
        where: {
          updatedAt: {
            not: prisma.product.fields.createdAt,
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: Math.floor(limit / 2),
        select: {
          id: true,
          name: true,
          sku: true,
          slug: true,
          updatedAt: true,
          brand: {
            select: {
              name: true,
            },
          },
        },
      });

      // Combine and format activities
      const activities: any[] = [];

      // Add price changes
      recentPriceChanges.forEach((change: any) => {
        activities.push({
          type: 'price_change',
          timestamp: change.createdAt,
          description: `Price updated for ${change.product.name}`,
          metadata: {
            productId: change.product.id,
            productName: change.product.name,
            sku: change.product.sku,
            slug: change.product.slug,
            oldPrice: change.oldPrice,
            newPrice: change.newPrice,
            changedBy: change.user?.fullName || 'System',
            reason: change.reason,
          },
        });
      });

      // Add new products
      recentProducts.forEach((product: any) => {
        activities.push({
          type: 'product_created',
          timestamp: product.createdAt,
          description: `New product added: ${product.name}`,
          metadata: {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            slug: product.slug,
            brand: product.brand?.name,
          },
        });
      });

      // Add product updates
      recentUpdates.forEach((product: any) => {
        activities.push({
          type: 'product_updated',
          timestamp: product.updatedAt,
          description: `Product updated: ${product.name}`,
          metadata: {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            slug: product.slug,
            brand: product.brand?.name,
          },
        });
      });

      // Sort by timestamp descending and limit
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return activities.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get recent activity', { error });
      throw error;
    }
  }

  /**
   * Get top viewed products
   */
  async getTopViewedProducts(limit = 10) {
    try {
      return prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          viewCount: {
            gt: 0,
          },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          slug: true,
          viewCount: true,
          currentPrice: true,
          brand: {
            select: {
              name: true,
            },
          },
          category: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          viewCount: 'desc',
        },
        take: limit,
      });
    } catch (error) {
      logger.error('Failed to get top viewed products', { error });
      throw error;
    }
  }

  /**
   * Get sales summary (from sales history)
   */
  async getSalesSummary(days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const salesData = await prisma.salesHistory.aggregate({
        where: {
          saleDate: {
            gte: startDate,
          },
        },
        _sum: {
          quantitySold: true,
          totalRevenue: true,
        },
        _count: {
          id: true,
        },
      });

      return {
        period: `Last ${days} days`,
        totalTransactions: salesData._count.id,
        totalQuantitySold: salesData._sum.quantitySold || 0,
        totalRevenue: salesData._sum.totalRevenue || 0,
      };
    } catch (error) {
      logger.error('Failed to get sales summary', { error });
      throw error;
    }
  }

  /**
   * Get lead statistics
   */
  async getLeadStats() {
    try {
      const statusCounts = await prisma.lead.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
      });

      const sourceCounts = await prisma.lead.groupBy({
        by: ['source'],
        _count: {
          source: true,
        },
      });

      return {
        byStatus: statusCounts.map((item: any) => ({
          status: item.status,
          count: item._count.status,
        })),
        bySource: sourceCounts.map((item: any) => ({
          source: item.source,
          count: item._count.source,
        })),
      };
    } catch (error) {
      logger.error('Failed to get lead stats', { error });
      throw error;
    }
  }
}
