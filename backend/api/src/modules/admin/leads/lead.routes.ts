import { FastifyInstance } from 'fastify';
import { LeadController } from './lead.controller.js';
import { LeadService } from './lead.service.js';
import { LeadRepository } from './lead.repository.js';
import { requireAuth } from '@/shared/auth/auth.middleware.js';

/**
 * Admin Lead Routes
 * All routes require authentication
 */
export async function leadRoutes(fastify: FastifyInstance) {
  // Initialize repository, service, and controller
  const leadRepository = new LeadRepository();
  const leadService = new LeadService(leadRepository);
  const leadController = new LeadController(leadService);

  // Apply authentication middleware to all routes
  fastify.addHook('onRequest', requireAuth);

  // Lead statistics and special queries (must come before :id routes)
  fastify.get('/api/v1/admin/leads/stats', leadController.getStats);
  fastify.get('/api/v1/admin/leads/recent', leadController.getRecent);
  fastify.get('/api/v1/admin/leads/high-potential', leadController.getHighPotential);

  // Lead CRUD endpoints
  fastify.get('/api/v1/admin/leads', leadController.list);
  fastify.get('/api/v1/admin/leads/:id', leadController.getById);
  fastify.put('/api/v1/admin/leads/:id', leadController.update);
  fastify.delete('/api/v1/admin/leads/:id', leadController.delete);

  // Status update endpoint
  fastify.patch('/api/v1/admin/leads/:id/status', leadController.updateStatus);
}
