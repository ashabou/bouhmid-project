import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service.js';
import { z } from 'zod';
import { logger } from '@/shared/logger/winston.config.js';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const initiatePasswordResetSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Authentication Controller
 * Handles HTTP requests for authentication endpoints
 */
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /api/v1/admin/auth/login
   * Authenticate user and return tokens
   */
  login = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const credentials = loginSchema.parse(request.body);

      const result = await this.authService.login(credentials);

      // Set refresh token as httpOnly cookie
      reply.setCookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
        path: '/',
      });

      // Return user info and access token
      return reply.send({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken, // Also include in response body for mobile/non-browser clients
      });
    } catch (error) {
      logger.error('Login failed', { error });
      throw error;
    }
  };

  /**
   * POST /api/v1/admin/auth/refresh
   * Refresh access token using refresh token
   */
  refresh = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Try to get refresh token from cookie first, then from body
      let refreshToken = request.cookies.refreshToken;

      if (!refreshToken) {
        const body = refreshTokenSchema.parse(request.body);
        refreshToken = body.refreshToken;
      }

      if (!refreshToken) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'No refresh token provided',
        });
      }

      const result = await this.authService.refreshAccessToken(refreshToken);

      return reply.send(result);
    } catch (error) {
      logger.error('Token refresh failed', { error });
      throw error;
    }
  };

  /**
   * POST /api/v1/admin/auth/logout
   * Logout user by revoking refresh token
   */
  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get refresh token from cookie or body
      let refreshToken = request.cookies.refreshToken;

      if (!refreshToken) {
        const body = request.body as any;
        refreshToken = body?.refreshToken;
      }

      if (refreshToken) {
        await this.authService.logout(refreshToken);
      }

      // Clear cookie
      reply.clearCookie('refreshToken', { path: '/' });

      return reply.send({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error('Logout failed', { error });
      // Always return success for logout
      reply.clearCookie('refreshToken', { path: '/' });
      return reply.send({
        success: true,
        message: 'Logged out successfully',
      });
    }
  };

  /**
   * POST /api/v1/admin/auth/change-password
   * Change user password (requires authentication)
   */
  changePassword = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const body = changePasswordSchema.parse(request.body);

      await this.authService.changePassword(
        request.user.userId,
        body.currentPassword,
        body.newPassword
      );

      // Clear refresh token cookie since all sessions are revoked
      reply.clearCookie('refreshToken', { path: '/' });

      return reply.send({
        success: true,
        message: 'Password changed successfully. Please login again.',
      });
    } catch (error) {
      logger.error('Password change failed', { error });
      throw error;
    }
  };

  /**
   * POST /api/v1/admin/auth/password-reset/initiate
   * Initiate password reset flow
   */
  initiatePasswordReset = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = initiatePasswordResetSchema.parse(request.body);

      const resetToken = await this.authService.initiatePasswordReset(body.email);

      // In production, send this token via email
      // For now, return it in response (REMOVE IN PRODUCTION)
      return reply.send({
        success: true,
        message: 'Password reset instructions sent to email',
        // TODO: Remove in production, send via email instead
        resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined,
      });
    } catch (error) {
      logger.error('Password reset initiation failed', { error });
      // Always return success to prevent user enumeration
      return reply.send({
        success: true,
        message: 'If an account with that email exists, password reset instructions have been sent',
      });
    }
  };

  /**
   * POST /api/v1/admin/auth/password-reset/complete
   * Complete password reset using reset token
   */
  resetPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = resetPasswordSchema.parse(request.body);

      await this.authService.resetPassword(body.token, body.newPassword);

      return reply.send({
        success: true,
        message: 'Password reset successfully. Please login with your new password.',
      });
    } catch (error) {
      logger.error('Password reset failed', { error });
      throw error;
    }
  };

  /**
   * GET /api/v1/admin/auth/me
   * Get current authenticated user info
   */
  getCurrentUser = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // Get full user details from database
      const { prisma } = await import('@/shared/database/client.js');
      const user = await prisma.user.findUnique({
        where: { id: request.user.userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      if (!user) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found',
        });
      }

      return reply.send({
        user,
      });
    } catch (error) {
      logger.error('Get current user failed', { error });
      throw error;
    }
  };
}
