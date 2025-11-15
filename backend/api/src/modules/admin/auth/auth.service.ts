import { prisma } from '@/shared/database/client.js';
import { jwtService } from '@/shared/auth/jwt.service.js';
import { passwordService } from '@/shared/auth/password.service.js';
import { logger } from '@/shared/logger/winston.config.js';
import { UnauthorizedError } from '@/shared/errors/app.error.js';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Authentication Service
 * Handles login, logout, token refresh, and session management
 */
export class AuthService {
  /**
   * Authenticate user with email and password
   * Returns user info and tokens if successful
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { email, password } = credentials;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // User not found or inactive
    if (!user || !user.isActive) {
      logger.warn('Login attempt failed: user not found or inactive', { email });
      throw new UnauthorizedError('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await passwordService.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      logger.warn('Login attempt failed: invalid password', { email, userId: user.id });
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const accessToken = jwtService.generateAccessToken(user.id, user.email, user.role);
    const refreshToken = await jwtService.generateRefreshToken(user.id);

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token using refresh token
   * Returns new access token if refresh token is valid
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    // Verify refresh token
    const userId = await jwtService.verifyRefreshToken(refreshToken);

    if (!userId) {
      logger.warn('Token refresh failed: invalid or expired refresh token');
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      logger.warn('Token refresh failed: user not found or inactive', { userId });
      throw new UnauthorizedError('User not found or inactive');
    }

    // Generate new access token
    const accessToken = jwtService.generateAccessToken(user.id, user.email, user.role);

    logger.debug('Access token refreshed', { userId: user.id });

    return { accessToken };
  }

  /**
   * Logout user by revoking refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    try {
      await jwtService.revokeRefreshToken(refreshToken);
      logger.debug('User logged out successfully');
    } catch (error) {
      logger.error('Logout failed', { error });
      // Don't throw - logout should always succeed from user's perspective
    }
  }

  /**
   * Revoke all sessions for a user
   * Useful for security events (password change, account compromise)
   */
  async revokeAllSessions(userId: string): Promise<void> {
    try {
      await jwtService.revokeAllRefreshTokens(userId);
      logger.info('All sessions revoked for user', { userId });
    } catch (error) {
      logger.error('Failed to revoke all sessions', { error, userId });
      throw new Error('Failed to revoke all sessions');
    }
  }

  /**
   * Validate user credentials (for password confirmation)
   */
  async validateCredentials(userId: string, password: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      return false;
    }

    return await passwordService.compare(password, user.passwordHash);
  }

  /**
   * Change user password
   * Revokes all sessions for security
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    // Verify current password
    const isCurrentPasswordValid = await passwordService.compare(
      currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      logger.warn('Password change failed: invalid current password', { userId });
      throw new UnauthorizedError('Invalid current password');
    }

    // Validate new password strength
    const passwordStrength = passwordService.validatePasswordStrength(newPassword);
    if (!passwordStrength.isValid) {
      throw new Error(`Password too weak: ${passwordStrength.feedback.join(', ')}`);
    }

    // Hash new password
    const newPasswordHash = await passwordService.hash(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Revoke all sessions for security
    await this.revokeAllSessions(userId);

    logger.info('Password changed successfully', { userId });
  }

  /**
   * Initiate password reset flow
   * Generates reset token and returns it (to be sent via email)
   */
  async initiatePasswordReset(email: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      // Don't reveal whether user exists (security best practice)
      logger.warn('Password reset requested for non-existent or inactive user', { email });
      // Return a fake token to prevent timing attacks
      return 'invalid-token';
    }

    const resetToken = await passwordService.generateResetToken(user.id);

    logger.info('Password reset initiated', { userId: user.id, email });

    return resetToken;
  }

  /**
   * Complete password reset using reset token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Verify reset token
    const userId = await passwordService.verifyResetToken(token);

    if (!userId) {
      logger.warn('Password reset failed: invalid or expired token');
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    // Validate new password strength
    const passwordStrength = passwordService.validatePasswordStrength(newPassword);
    if (!passwordStrength.isValid) {
      throw new Error(`Password too weak: ${passwordStrength.feedback.join(', ')}`);
    }

    // Hash new password
    const newPasswordHash = await passwordService.hash(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Consume reset token (prevent reuse)
    await passwordService.consumeResetToken(token);

    // Revoke all sessions for security
    await this.revokeAllSessions(userId);

    logger.info('Password reset completed', { userId });
  }
}
