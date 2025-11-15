export const databaseConfig = {
  url: process.env.DATABASE_URL!,

  // Connection pool settings
  pool: {
    min: 2,
    max: 10,
  },

  // Timeouts
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
} as const;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}
