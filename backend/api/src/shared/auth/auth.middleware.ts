import { FastifyRequest, FastifyReply } from 'fastify';
import { jwtService } from './jwt.service.js';
import { logger } from '../logger/winston.config.js';

/**
 * Extend Fastify Request to include user property
 * This will be set by auth middleware after token verification
 */
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      email: string;
      role: string;
    };
  }
}

/**
 * Authentication Middleware
 * Verifies JWT access token from Authorization header
 * Attaches user info to request.user if valid
 * Returns 401 if token is missing, invalid, or expired
 */
export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      logger.debug('Missing authorization header', {
        path: request.url,
        method: request.method,
      });
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing authorization header',
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      logger.debug('Invalid authorization header format', {
        path: request.url,
        method: request.method,
      });
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid authorization header format. Expected: Bearer <token>',
      });
    }

    // Extract token (remove "Bearer " prefix)
    const token = authHeader.substring(7);

    if (!token) {
      logger.debug('Empty token', {
        path: request.url,
        method: request.method,
      });
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing access token',
      });
    }

    // Verify token
    const payload = jwtService.verifyAccessToken(token);

    // Attach user info to request
    request.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    logger.debug('Request authenticated', {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      path: request.url,
      method: request.method,
    });
  } catch (error) {
    logger.debug('Authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: request.url,
      method: request.method,
    });

    return reply.code(401).send({
      error: 'Unauthorized',
      message: error instanceof Error ? error.message : 'Invalid or expired token',
    });
  }
};

/**
 * Role-based Authorization Middleware
 * Checks if authenticated user has one of the required roles
 * Must be used AFTER requireAuth middleware
 */
export const requireRole = (allowedRoles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Check if user is authenticated (requireAuth must be called first)
    if (!request.user) {
      logger.warn('requireRole called without requireAuth', {
        path: request.url,
        method: request.method,
      });
      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Check if user has required role
    const userRole = request.user.role;
    const hasRole = allowedRoles.includes(userRole);

    if (!hasRole) {
      logger.warn('Insufficient permissions', {
        userId: request.user.userId,
        userRole,
        requiredRoles: allowedRoles,
        path: request.url,
        method: request.method,
      });

      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
    }

    logger.debug('Role check passed', {
      userId: request.user.userId,
      userRole,
      requiredRoles: allowedRoles,
      path: request.url,
      method: request.method,
    });
  };
};

/**
 * Optional Authentication Middleware
 * Verifies JWT if present, but doesn't fail if missing
 * Useful for endpoints that behave differently for authenticated users
 * but are also available to anonymous users
 */
export const optionalAuth = async (request: FastifyRequest, _reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;

    // If no auth header, continue without authentication
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.debug('No authentication provided (optional)', {
        path: request.url,
        method: request.method,
      });
      return;
    }

    const token = authHeader.substring(7);

    if (!token) {
      return;
    }

    // Try to verify token
    try {
      const payload = jwtService.verifyAccessToken(token);
      request.user = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      };

      logger.debug('Optional auth: request authenticated', {
        userId: payload.userId,
        path: request.url,
        method: request.method,
      });
    } catch (error) {
      // Token is invalid but this is optional auth, so continue without user
      logger.debug('Optional auth: invalid token, continuing as anonymous', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: request.url,
        method: request.method,
      });
    }
  } catch (error) {
    // Any unexpected errors in optional auth should not block the request
    logger.error('Unexpected error in optionalAuth middleware', {
      error,
      path: request.url,
      method: request.method,
    });
  }
};

/**
 * Admin-only middleware (convenience wrapper)
 * Requires authentication and ADMIN role
 */
export const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
  await requireAuth(request, reply);
  if (reply.sent) return; // If requireAuth already sent a response, stop

  await requireRole(['ADMIN'])(request, reply);
};
