import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './app.error.js';
import { logger } from '../logger/winston.config.js';

/**
 * Global error handler for Fastify
 */
export async function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log error
  logger.error('Error occurred', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    request: {
      method: request.method,
      url: request.url,
      params: request.params,
      query: request.query,
      body: request.body,
    },
  });

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(422).send({
      statusCode: 422,
      error: 'Validation Error',
      message: 'Invalid request data',
      details: error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  // Handle custom application errors
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      statusCode: error.statusCode,
      error: error.name,
      message: error.message,
      code: error.code,
      details: error.details,
    });
  }

  // Handle Fastify validation errors
  if ('validation' in error && error.validation) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: error.message,
      details: error.validation,
    });
  }

  // Handle other known Fastify errors
  if ('statusCode' in error && error.statusCode) {
    return reply.status(error.statusCode).send({
      statusCode: error.statusCode,
      error: error.name,
      message: error.message,
    });
  }

  // Default to 500 Internal Server Error
  return reply.status(500).send({
    statusCode: 500,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : error.message,
  });
}
