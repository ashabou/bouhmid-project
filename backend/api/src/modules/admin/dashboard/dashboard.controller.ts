import { FastifyRequest, FastifyReply } from 'fastify';
import { DashboardService } from './dashboard.service.js';
import { z } from 'zod';

/**
 * Validation Schemas
 */
const getRecentActivitySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(parseInt(val, 10), 100) : 20)),
});

const getLowStockSchema = z.object({
  threshold: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(parseInt(val, 10), 50) : 20)),
});

const getTopProductsSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(parseInt(val, 10), 50) : 10)),
});

/**
 * Dashboard Controller
 */
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  /**
   * Get comprehensive dashboard overview
   * GET /api/v1/admin/dashboard/overview
   */
  getOverview = async (_request: FastifyRequest, reply: FastifyReply) => {
    const overview = await this.dashboardService.getOverview();

    return reply.send({
      success: true,
      data: overview,
    });
  };

  /**
   * Get recent activity feed
   * GET /api/v1/admin/dashboard/activity
   */
  getRecentActivity = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = getRecentActivitySchema.parse(request.query);

    const result = await this.dashboardService.getRecentActivity(query.limit);

    return reply.send({
      success: true,
      ...result,
    });
  };

  /**
   * Get detailed statistics
   * GET /api/v1/admin/dashboard/stats
   */
  getDetailedStats = async (_request: FastifyRequest, reply: FastifyReply) => {
    const stats = await this.dashboardService.getDetailedStats();

    return reply.send({
      success: true,
      data: stats,
    });
  };

  /**
   * Get low stock alerts
   * GET /api/v1/admin/dashboard/low-stock
   */
  getLowStockAlerts = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = getLowStockSchema.parse(request.query);

    const result = await this.dashboardService.getLowStockAlerts(
      query.threshold,
      query.limit
    );

    return reply.send({
      success: true,
      ...result,
    });
  };

  /**
   * Get top performing products
   * GET /api/v1/admin/dashboard/top-products
   */
  getTopProducts = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = getTopProductsSchema.parse(request.query);

    const result = await this.dashboardService.getTopPerformingProducts(query.limit);

    return reply.send({
      success: true,
      ...result,
    });
  };

  /**
   * Invalidate dashboard caches
   * POST /api/v1/admin/dashboard/refresh
   */
  refreshDashboard = async (_request: FastifyRequest, reply: FastifyReply) => {
    await this.dashboardService.invalidateDashboardCaches();

    return reply.send({
      success: true,
      message: 'Dashboard caches invalidated. Fresh data will be loaded on next request.',
    });
  };
}
