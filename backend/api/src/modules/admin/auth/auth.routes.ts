import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { requireAuth } from '@/shared/auth/auth.middleware.js';

/**
 * Authentication Routes
 * Handles user authentication, token management, and password operations
 */
export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();
  const authController = new AuthController(authService);

  // Public routes (no authentication required)

  /**
   * POST /api/v1/admin/auth/login
   * Authenticate user with email and password
   */
  fastify.post('/admin/auth/login', authController.login);

  /**
   * POST /api/v1/admin/auth/refresh
   * Refresh access token using refresh token
   */
  fastify.post('/admin/auth/refresh', authController.refresh);

  /**
   * POST /api/v1/admin/auth/password-reset/initiate
   * Initiate password reset flow
   */
  fastify.post('/admin/auth/password-reset/initiate', authController.initiatePasswordReset);

  /**
   * POST /api/v1/admin/auth/password-reset/complete
   * Complete password reset using reset token
   */
  fastify.post('/admin/auth/password-reset/complete', authController.resetPassword);

  // Protected routes (authentication required)

  /**
   * POST /api/v1/admin/auth/logout
   * Logout user by revoking refresh token
   */
  fastify.post('/admin/auth/logout', {
    preHandler: [requireAuth],
    handler: authController.logout,
  });

  /**
   * POST /api/v1/admin/auth/change-password
   * Change user password
   */
  fastify.post('/admin/auth/change-password', {
    preHandler: [requireAuth],
    handler: authController.changePassword,
  });

  /**
   * GET /api/v1/admin/auth/me
   * Get current authenticated user info
   */
  fastify.get('/admin/auth/me', {
    preHandler: [requireAuth],
    handler: authController.getCurrentUser,
  });
}
