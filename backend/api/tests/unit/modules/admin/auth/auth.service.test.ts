import { AuthService } from '@/modules/admin/auth/auth.service';
import { prisma } from '@/shared/database/client';
import { jwtService } from '@/shared/auth/jwt.service';
import { passwordService } from '@/shared/auth/password.service';
import { UnauthorizedError } from '@/shared/errors/app.error';

// Mock dependencies
jest.mock('@/shared/database/client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock('@/shared/auth/jwt.service');
jest.mock('@/shared/auth/password.service');
jest.mock('@/shared/logger/winston.config', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('AuthService', () => {
  let authService: AuthService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    fullName: 'Test User',
    role: 'ADMIN',
    passwordHash: '$2b$10$hashedpassword',
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTokens = {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-123',
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create service instance
    authService = new AuthService();
  });

  describe('login', () => {
    const credentials = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should successfully authenticate valid credentials', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.generateAccessToken as jest.Mock).mockReturnValue(
        mockTokens.accessToken
      );
      (jwtService.generateRefreshToken as jest.Mock).mockResolvedValue(
        mockTokens.refreshToken
      );
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      // Act
      const result = await authService.login(credentials);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: credentials.email },
      });
      expect(passwordService.compare).toHaveBeenCalledWith(
        credentials.password,
        mockUser.passwordHash
      );
      expect(jwtService.generateAccessToken).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email,
        mockUser.role
      );
      expect(jwtService.generateRefreshToken).toHaveBeenCalledWith(mockUser.id);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });
      expect(result).toEqual({
        user: {
          id: mockUser.id,
          email: mockUser.email,
          fullName: mockUser.fullName,
          role: mockUser.role,
        },
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
      });
    });

    it('should throw UnauthorizedError when user not found', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(authService.login(credentials)).rejects.toThrow(UnauthorizedError);
      await expect(authService.login(credentials)).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should throw UnauthorizedError when user is inactive', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      // Act & Assert
      await expect(authService.login(credentials)).rejects.toThrow(UnauthorizedError);
      await expect(authService.login(credentials)).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should throw UnauthorizedError when password is invalid', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(authService.login(credentials)).rejects.toThrow(UnauthorizedError);
      await expect(authService.login(credentials)).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should update lastLoginAt timestamp on successful login', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.generateAccessToken as jest.Mock).mockReturnValue(
        mockTokens.accessToken
      );
      (jwtService.generateRefreshToken as jest.Mock).mockResolvedValue(
        mockTokens.refreshToken
      );
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const beforeLogin = new Date();

      // Act
      await authService.login(credentials);

      // Assert
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLoginAt: expect.any(Date) },
      });

      const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.lastLoginAt.getTime()).toBeGreaterThanOrEqual(
        beforeLogin.getTime()
      );
    });
  });

  describe('refreshAccessToken', () => {
    const refreshToken = 'refresh-token-123';

    it('should generate new access token with valid refresh token', async () => {
      // Arrange
      (jwtService.verifyRefreshToken as jest.Mock).mockResolvedValue(mockUser.id);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (jwtService.generateAccessToken as jest.Mock).mockReturnValue(
        mockTokens.accessToken
      );

      // Act
      const result = await authService.refreshAccessToken(refreshToken);

      // Assert
      expect(jwtService.verifyRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(jwtService.generateAccessToken).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.email,
        mockUser.role
      );
      expect(result).toEqual({ accessToken: mockTokens.accessToken });
    });

    it('should throw UnauthorizedError when refresh token is invalid', async () => {
      // Arrange
      (jwtService.verifyRefreshToken as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow(
        UnauthorizedError
      );
      await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow(
        'Invalid or expired refresh token'
      );
    });

    it('should throw UnauthorizedError when user not found', async () => {
      // Arrange
      (jwtService.verifyRefreshToken as jest.Mock).mockResolvedValue(mockUser.id);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow(
        UnauthorizedError
      );
      await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow(
        'User not found or inactive'
      );
    });

    it('should throw UnauthorizedError when user is inactive', async () => {
      // Arrange
      (jwtService.verifyRefreshToken as jest.Mock).mockResolvedValue(mockUser.id);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      // Act & Assert
      await expect(authService.refreshAccessToken(refreshToken)).rejects.toThrow(
        UnauthorizedError
      );
    });
  });

  describe('logout', () => {
    const refreshToken = 'refresh-token-123';

    it('should revoke refresh token successfully', async () => {
      // Arrange
      (jwtService.revokeRefreshToken as jest.Mock).mockResolvedValue(undefined);

      // Act
      await authService.logout(refreshToken);

      // Assert
      expect(jwtService.revokeRefreshToken).toHaveBeenCalledWith(refreshToken);
    });

    it('should not throw error even if revocation fails', async () => {
      // Arrange
      (jwtService.revokeRefreshToken as jest.Mock).mockRejectedValue(
        new Error('Revocation failed')
      );

      // Act & Assert - should not throw
      await expect(authService.logout(refreshToken)).resolves.not.toThrow();
    });
  });

  describe('revokeAllSessions', () => {
    const userId = 'user-123';

    it('should revoke all refresh tokens for user', async () => {
      // Arrange
      (jwtService.revokeAllRefreshTokens as jest.Mock).mockResolvedValue(undefined);

      // Act
      await authService.revokeAllSessions(userId);

      // Assert
      expect(jwtService.revokeAllRefreshTokens).toHaveBeenCalledWith(userId);
    });

    it('should throw error if revocation fails', async () => {
      // Arrange
      (jwtService.revokeAllRefreshTokens as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(authService.revokeAllSessions(userId)).rejects.toThrow(
        'Failed to revoke all sessions'
      );
    });
  });

  describe('validateCredentials', () => {
    const userId = 'user-123';
    const password = 'password123';

    it('should return true for valid credentials', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await authService.validateCredentials(userId, password);

      // Assert
      expect(result).toBe(true);
      expect(passwordService.compare).toHaveBeenCalledWith(
        password,
        mockUser.passwordHash
      );
    });

    it('should return false when user not found', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await authService.validateCredentials(userId, password);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when user is inactive', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      // Act
      const result = await authService.validateCredentials(userId, password);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when password is invalid', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.compare as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await authService.validateCredentials(userId, password);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('changePassword', () => {
    const userId = 'user-123';
    const currentPassword = 'oldPassword123';
    const newPassword = 'NewSecurePassword456!';

    it('should successfully change password', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.compare as jest.Mock).mockResolvedValue(true);
      (passwordService.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: true,
        feedback: [],
      });
      (passwordService.hash as jest.Mock).mockResolvedValue('$2b$10$newhash');
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      (jwtService.revokeAllRefreshTokens as jest.Mock).mockResolvedValue(undefined);

      // Act
      await authService.changePassword(userId, currentPassword, newPassword);

      // Assert
      expect(passwordService.compare).toHaveBeenCalledWith(
        currentPassword,
        mockUser.passwordHash
      );
      expect(passwordService.validatePasswordStrength).toHaveBeenCalledWith(newPassword);
      expect(passwordService.hash).toHaveBeenCalledWith(newPassword);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { passwordHash: '$2b$10$newhash' },
      });
      expect(jwtService.revokeAllRefreshTokens).toHaveBeenCalledWith(userId);
    });

    it('should throw error when user not found', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(
        authService.changePassword(userId, currentPassword, newPassword)
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw error when current password is invalid', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.compare as jest.Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(
        authService.changePassword(userId, currentPassword, newPassword)
      ).rejects.toThrow('Invalid current password');
    });

    it('should throw error when new password is weak', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.compare as jest.Mock).mockResolvedValue(true);
      (passwordService.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: false,
        feedback: ['Password is too short', 'Add special characters'],
      });

      // Act & Assert
      await expect(
        authService.changePassword(userId, currentPassword, 'weak')
      ).rejects.toThrow('Password too weak');
    });
  });

  describe('initiatePasswordReset', () => {
    const email = 'test@example.com';

    it('should generate reset token for valid user', async () => {
      // Arrange
      const resetToken = 'reset-token-123';
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.generateResetToken as jest.Mock).mockResolvedValue(resetToken);

      // Act
      const result = await authService.initiatePasswordReset(email);

      // Assert
      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email } });
      expect(passwordService.generateResetToken).toHaveBeenCalledWith(mockUser.id);
      expect(result).toBe(resetToken);
    });

    it('should return fake token when user not found (prevent timing attacks)', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await authService.initiatePasswordReset(email);

      // Assert
      expect(result).toBe('invalid-token');
      expect(passwordService.generateResetToken).not.toHaveBeenCalled();
    });

    it('should return fake token when user is inactive', async () => {
      // Arrange
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      // Act
      const result = await authService.initiatePasswordReset(email);

      // Assert
      expect(result).toBe('invalid-token');
    });
  });

  describe('resetPassword', () => {
    const token = 'reset-token-123';
    const newPassword = 'NewSecurePassword456!';

    it('should successfully reset password', async () => {
      // Arrange
      (passwordService.verifyResetToken as jest.Mock).mockResolvedValue(mockUser.id);
      (passwordService.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: true,
        feedback: [],
      });
      (passwordService.hash as jest.Mock).mockResolvedValue('$2b$10$newhash');
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      (passwordService.consumeResetToken as jest.Mock).mockResolvedValue(undefined);
      (jwtService.revokeAllRefreshTokens as jest.Mock).mockResolvedValue(undefined);

      // Act
      await authService.resetPassword(token, newPassword);

      // Assert
      expect(passwordService.verifyResetToken).toHaveBeenCalledWith(token);
      expect(passwordService.validatePasswordStrength).toHaveBeenCalledWith(newPassword);
      expect(passwordService.hash).toHaveBeenCalledWith(newPassword);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { passwordHash: '$2b$10$newhash' },
      });
      expect(passwordService.consumeResetToken).toHaveBeenCalledWith(token);
      expect(jwtService.revokeAllRefreshTokens).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw error when reset token is invalid', async () => {
      // Arrange
      (passwordService.verifyResetToken as jest.Mock).mockResolvedValue(null);

      // Act & Assert
      await expect(authService.resetPassword(token, newPassword)).rejects.toThrow(
        'Invalid or expired reset token'
      );
    });

    it('should throw error when new password is weak', async () => {
      // Arrange
      (passwordService.verifyResetToken as jest.Mock).mockResolvedValue(mockUser.id);
      (passwordService.validatePasswordStrength as jest.Mock).mockReturnValue({
        isValid: false,
        feedback: ['Password is too short'],
      });

      // Act & Assert
      await expect(authService.resetPassword(token, 'weak')).rejects.toThrow(
        'Password too weak'
      );
    });
  });
});
