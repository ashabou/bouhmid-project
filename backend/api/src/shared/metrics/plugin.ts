/**
 * Fastify Metrics Plugin
 *
 * Automatically tracks HTTP requests and integrates with Prometheus metrics
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { recordHttpRequest, getMetrics } from './prometheus.js';

async function metricsPlugin(fastify: FastifyInstance) {
  // Track request duration
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    request.startTime = Date.now();
  });

  // Record metrics after response
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const duration = Date.now() - (request.startTime || 0);
    const route = request.routeOptions?.url || request.url;

    recordHttpRequest(
      request.method,
      route,
      reply.statusCode,
      duration
    );
  });

  // Metrics endpoint
  fastify.get('/metrics', async (request, reply) => {
    try {
      const metrics = await getMetrics();
      reply
        .code(200)
        .header('Content-Type', 'text/plain; version=0.0.4')
        .send(metrics);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to generate metrics' });
    }
  });
}

// Extend FastifyRequest interface
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

export default fp(metricsPlugin, {
  name: 'metrics',
  fastify: '5.x',
});
