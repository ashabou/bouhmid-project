/**
 * Jest test setup file
 * Runs before all tests to configure global mocks and environment
 */

// Set up test environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing-purposes-only';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Mock Redis client
jest.mock('@/shared/cache/redis.client', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    flushdb: jest.fn(),
    quit: jest.fn(),
  },
}));

// Mock Redis config
jest.mock('@/config/redis.config', () => ({
  redisConfig: {
    host: 'localhost',
    port: 6379,
    db: 0,
  },
}));

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
