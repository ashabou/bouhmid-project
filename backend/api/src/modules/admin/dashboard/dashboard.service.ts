import { DashboardRepository } from './dashboard.repository.js';
import { cacheService } from '@/shared/cache/cache.service.js';
import { logger } from '@/shared/logger/winston.config.js';

/**
 * Dashboard Service
 * Business logic for dashboard statistics with caching
 */
export class DashboardService {
  constructor(private dashboardRepository: DashboardRepository) {}

  /**
   * Get comprehensive dashboard overview
   */
  async getOverview() {
    const cacheKey = 'dashboard:overview';

    // Check cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Dashboard overview cache hit');
      return cached;
    }

    // Fetch all data in parallel
    const [
      totalCounts,
      productStatusBreakdown,
      lowStockProducts,
      topViewedProducts,
      salesSummary,
      leadStats,
    ] = await Promise.all([
      this.dashboardRepository.getTotalCounts(),
      this.dashboardRepository.getProductStatusBreakdown(),
      this.dashboardRepository.getLowStockProducts(10, 5),
      this.dashboardRepository.getTopViewedProducts(5),
      this.dashboardRepository.getSalesSummary(30),
      this.dashboardRepository.getLeadStats(),
    ]);

    const overview = {
      counts: totalCounts,
      productStatus: productStatusBreakdown,
      lowStock: {
        threshold: 10,
        products: lowStockProducts,
        count: lowStockProducts.length,
      },
      topViewed: topViewedProducts,
      sales: salesSummary,
      leads: leadStats,
      generatedAt: new Date().toISOString(),
    };

    // Cache for 5 minutes
    await cacheService.set(cacheKey, overview, 300);

    logger.info('Dashboard overview generated');

    return overview;
  }

  /**
   * Get recent activity feed
   */
  async getRecentActivity(limit = 20) {
    const cacheKey = `dashboard:activity:${limit}`;

    // Check cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Dashboard activity cache hit');
      return cached;
    }

    const activities = await this.dashboardRepository.getRecentActivity(limit);

    const result = {
      data: activities,
      total: activities.length,
      generatedAt: new Date().toISOString(),
    };

    // Cache for 2 minutes
    await cacheService.set(cacheKey, result, 120);

    return result;
  }

  /**
   * Get detailed statistics
   */
  async getDetailedStats() {
    const cacheKey = 'dashboard:detailed-stats';

    // Check cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Dashboard detailed stats cache hit');
      return cached;
    }

    const [
      totalCounts,
      productStatusBreakdown,
      salesSummary30Days,
      salesSummary7Days,
      leadStats,
    ] = await Promise.all([
      this.dashboardRepository.getTotalCounts(),
      this.dashboardRepository.getProductStatusBreakdown(),
      this.dashboardRepository.getSalesSummary(30),
      this.dashboardRepository.getSalesSummary(7),
      this.dashboardRepository.getLeadStats(),
    ]);

    const stats = {
      inventory: {
        ...totalCounts,
        statusBreakdown: productStatusBreakdown,
      },
      sales: {
        last30Days: salesSummary30Days,
        last7Days: salesSummary7Days,
      },
      leads: leadStats,
      generatedAt: new Date().toISOString(),
    };

    // Cache for 10 minutes
    await cacheService.set(cacheKey, stats, 600);

    logger.info('Dashboard detailed stats generated');

    return stats;
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(threshold = 10, limit = 20) {
    const cacheKey = `dashboard:low-stock:${threshold}:${limit}`;

    // Check cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Dashboard low stock cache hit');
      return cached;
    }

    const products = await this.dashboardRepository.getLowStockProducts(
      threshold,
      limit
    );

    const result = {
      threshold,
      products,
      count: products.length,
      generatedAt: new Date().toISOString(),
    };

    // Cache for 5 minutes
    await cacheService.set(cacheKey, result, 300);

    return result;
  }

  /**
   * Get top performing products
   */
  async getTopPerformingProducts(limit = 10) {
    const cacheKey = `dashboard:top-products:${limit}`;

    // Check cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Dashboard top products cache hit');
      return cached;
    }

    const products = await this.dashboardRepository.getTopViewedProducts(limit);

    const result = {
      products,
      count: products.length,
      generatedAt: new Date().toISOString(),
    };

    // Cache for 10 minutes
    await cacheService.set(cacheKey, result, 600);

    return result;
  }

  /**
   * Invalidate all dashboard caches
   * Call this when data changes that affect dashboard stats
   */
  async invalidateDashboardCaches() {
    try {
      await cacheService.invalidate('dashboard:*');
      logger.info('Dashboard caches invalidated');
    } catch (error) {
      logger.error('Failed to invalidate dashboard caches', { error });
      // Don't throw - cache invalidation failure should not block operations
    }
  }
}
