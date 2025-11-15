import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { redis } from '../cache/redis.client.js';
import { logger } from '../logger/winston.config.js';

/**
 * Password Service
 * Handles password hashing, comparison, validation, and reset tokens
 */
export class PasswordService {
  private readonly SALT_ROUNDS = 10;
  private readonly RESET_TOKEN_EXPIRY_SECONDS = 60 * 60; // 1 hour
  private readonly MIN_PASSWORD_LENGTH = 8;
  private readonly MAX_PASSWORD_LENGTH = 128;

  /**
   * Hash a plain text password using bcrypt
   */
  async hash(password: string): Promise<string> {
    try {
      // Validate password before hashing
      this.validatePasswordFormat(password);

      const hash = await bcrypt.hash(password, this.SALT_ROUNDS);
      logger.debug('Password hashed successfully');
      return hash;
    } catch (error) {
      logger.error('Failed to hash password', { error });
      throw error;
    }
  }

  /**
   * Compare a plain text password with a hash
   * Returns true if they match, false otherwise
   */
  async compare(password: string, hash: string): Promise<boolean> {
    try {
      const isMatch = await bcrypt.compare(password, hash);
      logger.debug('Password comparison completed', { isMatch });
      return isMatch;
    } catch (error) {
      logger.error('Failed to compare password', { error });
      throw new Error('Password comparison failed');
    }
  }

  /**
   * Validate password format (length)
   * Throws error if password doesn't meet requirements
   */
  private validatePasswordFormat(password: string): void {
    if (typeof password !== 'string') {
      throw new Error('Password must be a string');
    }

    if (password.length < this.MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${this.MIN_PASSWORD_LENGTH} characters long`);
    }

    if (password.length > this.MAX_PASSWORD_LENGTH) {
      throw new Error(`Password must be at most ${this.MAX_PASSWORD_LENGTH} characters long`);
    }
  }

  /**
   * Validate password strength
   * Returns an object with validation result and feedback
   */
  validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number; // 0-4 (weak to very strong)
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    // Check length
    if (password.length < this.MIN_PASSWORD_LENGTH) {
      feedback.push(`Password must be at least ${this.MIN_PASSWORD_LENGTH} characters long`);
      return { isValid: false, score: 0, feedback };
    }

    if (password.length > this.MAX_PASSWORD_LENGTH) {
      feedback.push(`Password must be at most ${this.MAX_PASSWORD_LENGTH} characters long`);
      return { isValid: false, score: 0, feedback };
    }

    // Length score
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;

    // Character variety
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (hasLowercase) score += 0.5;
    if (hasUppercase) score += 0.5;
    if (hasNumbers) score += 0.5;
    if (hasSpecialChars) score += 0.5;

    // Feedback
    if (!hasLowercase) feedback.push('Add lowercase letters');
    if (!hasUppercase) feedback.push('Add uppercase letters');
    if (!hasNumbers) feedback.push('Add numbers');
    if (!hasSpecialChars) feedback.push('Add special characters (!@#$%^&*)');

    // Common patterns (weak)
    const commonPatterns = [
      /^123456/,
      /^password/i,
      /^qwerty/i,
      /^abc123/i,
      /^111111/,
      /^letmein/i,
      /^welcome/i,
      /^monkey/i,
      /^dragon/i,
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        feedback.push('Avoid common passwords');
        score = Math.max(0, score - 2);
        break;
      }
    }

    // Sequential characters (weak)
    if (/(.)\1{2,}/.test(password)) {
      feedback.push('Avoid repeated characters (aaa, 111)');
      score = Math.max(0, score - 0.5);
    }

    // Normalize score to 0-4
    const normalizedScore = Math.min(4, Math.max(0, Math.round(score)));

    // Determine if valid (score >= 2)
    const isValid = normalizedScore >= 2;

    if (isValid && feedback.length === 0) {
      feedback.push('Strong password!');
    }

    return {
      isValid,
      score: normalizedScore,
      feedback,
    };
  }

  /**
   * Generate a password reset token
   * Stores token in Redis with user ID and expiry
   * Returns the token to send to user (via email)
   */
  async generateResetToken(userId: string): Promise<string> {
    try {
      // Generate secure random token (32 bytes = 64 hex characters)
      const token = randomBytes(32).toString('hex');

      // Store in Redis with 1 hour expiry
      const key = `password-reset:${token}`;
      await redis.setex(key, this.RESET_TOKEN_EXPIRY_SECONDS, userId);

      logger.info('Password reset token generated', { userId });
      return token;
    } catch (error) {
      logger.error('Failed to generate reset token', { error, userId });
      throw new Error('Failed to generate reset token');
    }
  }

  /**
   * Verify a password reset token
   * Returns userId if valid, null if expired or invalid
   */
  async verifyResetToken(token: string): Promise<string | null> {
    try {
      const key = `password-reset:${token}`;
      const userId = await redis.get(key);

      if (!userId) {
        logger.debug('Reset token not found or expired', { token: token.substring(0, 8) + '...' });
        return null;
      }

      logger.debug('Reset token verified', { userId });
      return userId;
    } catch (error) {
      logger.error('Failed to verify reset token', { error });
      return null;
    }
  }

  /**
   * Consume (delete) a password reset token after use
   * Prevents token reuse
   */
  async consumeResetToken(token: string): Promise<void> {
    try {
      const key = `password-reset:${token}`;
      await redis.del(key);
      logger.debug('Reset token consumed');
    } catch (error) {
      logger.error('Failed to consume reset token', { error });
      // Don't throw - token consumption failure shouldn't block password reset
    }
  }

  /**
   * Invalidate all reset tokens for a user
   * Useful when password is changed or account is compromised
   */
  async invalidateAllResetTokens(userId: string): Promise<void> {
    try {
      // Get all reset token keys
      const pattern = `password-reset:*`;
      const keys = await redis.keys(pattern);

      // Filter keys that belong to this user
      const userKeys: string[] = [];
      for (const key of keys) {
        const storedUserId = await redis.get(key);
        if (storedUserId === userId) {
          userKeys.push(key);
        }
      }

      // Delete all user's reset tokens
      if (userKeys.length > 0) {
        await redis.del(...userKeys);
        logger.info('All reset tokens invalidated for user', { userId, count: userKeys.length });
      }
    } catch (error) {
      logger.error('Failed to invalidate reset tokens', { error, userId });
      // Don't throw - this is a best-effort cleanup
    }
  }
}

// Export singleton instance
export const passwordService = new PasswordService();
