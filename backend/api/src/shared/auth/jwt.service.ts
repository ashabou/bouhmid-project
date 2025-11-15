import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { redis } from '../cache/redis.client.js';
import { logger } from '../logger/winston.config.js';

/**
 * JWT Service
 * Handles generation, verification, and revocation of JWT tokens
 * - Access tokens: Short-lived (15 minutes), signed with JWT_SECRET
 * - Refresh tokens: Long-lived (7 days), signed with JWT_REFRESH_SECRET, stored in Redis whitelist
 */
export class JWTService {
  private readonly ACCESS_TOKEN_SECRET: string;
  private readonly REFRESH_TOKEN_SECRET: string;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';
  private readonly REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor() {
    this.ACCESS_TOKEN_SECRET = process.env.JWT_SECRET!;
    this.REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET!;

    if (!this.ACCESS_TOKEN_SECRET || !this.REFRESH_TOKEN_SECRET) {
      throw new Error('JWT secrets not configured. Set JWT_SECRET and JWT_REFRESH_SECRET environment variables.');
    }
  }

  /**
   * Generate access token (short-lived)
   * Used for API authentication
   */
  generateAccessToken(userId: string, email: string, role: string): string {
    try {
      const token = jwt.sign(
        { userId, email, role },
        this.ACCESS_TOKEN_SECRET,
        { expiresIn: this.ACCESS_TOKEN_EXPIRY, algorithm: 'HS256' }
      );

      logger.debug('Access token generated', { userId, email, role });
      return token;
    } catch (error) {
      logger.error('Failed to generate access token', { error, userId });
      throw new Error('Failed to generate access token');
    }
  }

  /**
   * Generate refresh token (long-lived)
   * Stored in Redis whitelist for revocation capability
   */
  async generateRefreshToken(userId: string): Promise<string> {
    try {
      const jti = randomUUID(); // Unique token ID for revocation
      const token = jwt.sign(
        { userId, jti },
        this.REFRESH_TOKEN_SECRET,
        { expiresIn: this.REFRESH_TOKEN_EXPIRY, algorithm: 'HS256' }
      );

      // Store in Redis whitelist (key: refresh:{jti}, value: userId)
      await redis.setex(`refresh:${jti}`, this.REFRESH_TOKEN_EXPIRY_SECONDS, userId);

      logger.debug('Refresh token generated and stored', { userId, jti });
      return token;
    } catch (error) {
      logger.error('Failed to generate refresh token', { error, userId });
      throw new Error('Failed to generate refresh token');
    }
  }

  /**
   * Verify access token
   * Returns decoded payload if valid
   * Throws error if invalid or expired
   */
  verifyAccessToken(token: string): { userId: string; email: string; role: string } {
    try {
      const decoded = jwt.verify(token, this.ACCESS_TOKEN_SECRET) as {
        userId: string;
        email: string;
        role: string;
      };

      logger.debug('Access token verified', { userId: decoded.userId });
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.debug('Access token expired', { error });
        throw new Error('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.debug('Invalid access token', { error });
        throw new Error('Invalid token');
      }
      logger.error('Failed to verify access token', { error });
      throw new Error('Token verification failed');
    }
  }

  /**
   * Verify refresh token
   * Checks token signature AND Redis whitelist (for revocation)
   * Returns userId if valid, null if revoked or invalid
   */
  async verifyRefreshToken(token: string): Promise<string | null> {
    try {
      const decoded = jwt.verify(token, this.REFRESH_TOKEN_SECRET) as {
        userId: string;
        jti: string;
      };

      // Check if token is in Redis whitelist (not revoked)
      const userId = await redis.get(`refresh:${decoded.jti}`);

      if (!userId || userId !== decoded.userId) {
        logger.debug('Refresh token not in whitelist or userId mismatch', {
          jti: decoded.jti,
          userId: decoded.userId,
        });
        return null;
      }

      logger.debug('Refresh token verified', { userId, jti: decoded.jti });
      return userId;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.debug('Refresh token expired', { error });
        return null;
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.debug('Invalid refresh token', { error });
        return null;
      }
      logger.error('Failed to verify refresh token', { error });
      return null;
    }
  }

  /**
   * Revoke refresh token
   * Removes token from Redis whitelist, making it invalid for future use
   */
  async revokeRefreshToken(token: string): Promise<void> {
    try {
      const decoded = jwt.verify(token, this.REFRESH_TOKEN_SECRET) as {
        userId: string;
        jti: string;
      };

      // Remove from Redis whitelist
      await redis.del(`refresh:${decoded.jti}`);

      logger.info('Refresh token revoked', { userId: decoded.userId, jti: decoded.jti });
    } catch (error) {
      logger.error('Failed to revoke refresh token', { error });
      // Don't throw - revocation failures shouldn't block logout
    }
  }

  /**
   * Revoke all refresh tokens for a user
   * Useful for password reset or account security events
   */
  async revokeAllRefreshTokens(userId: string): Promise<void> {
    try {
      // Get all refresh token keys for this user
      const pattern = `refresh:*`;
      const keys = await redis.keys(pattern);

      // Filter keys that belong to this user
      const userKeys: string[] = [];
      for (const key of keys) {
        const storedUserId = await redis.get(key);
        if (storedUserId === userId) {
          userKeys.push(key);
        }
      }

      // Delete all user's refresh tokens
      if (userKeys.length > 0) {
        await redis.del(...userKeys);
        logger.info('All refresh tokens revoked for user', { userId, count: userKeys.length });
      } else {
        logger.debug('No refresh tokens found for user', { userId });
      }
    } catch (error) {
      logger.error('Failed to revoke all refresh tokens', { error, userId });
      throw new Error('Failed to revoke all refresh tokens');
    }
  }
}

// Export singleton instance
export const jwtService = new JWTService();
