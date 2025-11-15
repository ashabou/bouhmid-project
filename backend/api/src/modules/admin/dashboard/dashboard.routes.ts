import { FastifyInstance } from 'fastify';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardRepository } from './dashboard.repository.js';
import { requireAuth } from '@/shared/auth/auth.middleware.js';

/**
 * Admin Dashboard Routes
 * All routes require authentication
 */
export async function dashboardRoutes(fastify: FastifyInstance) {
  // Initialize repository, service, and controller
  const dashboardRepository = new DashboardRepository();
  const dashboardService = new DashboardService(dashboardRepository);
  const dashboardController = new DashboardController(dashboardService);

  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', requireAuth);

  // Dashboard endpoints
  fastify.get('/api/v1/admin/dashboard/overview', dashboardController.getOverview);
  fastify.get('/api/v1/admin/dashboard/activity', dashboardController.getRecentActivity);
  fastify.get('/api/v1/admin/dashboard/stats', dashboardController.getDetailedStats);
  fastify.get('/api/v1/admin/dashboard/low-stock', dashboardController.getLowStockAlerts);
  fastify.get('/api/v1/admin/dashboard/top-products', dashboardController.getTopProducts);
  fastify.post('/api/v1/admin/dashboard/refresh', dashboardController.refreshDashboard);
}
