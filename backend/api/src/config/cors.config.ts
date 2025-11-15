import type { FastifyCorsOptions } from '@fastify/cors';

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://shabouautopieces.tn',
  'https://www.shabouautopieces.tn',
];

export const corsConfig: FastifyCorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
} as const;
