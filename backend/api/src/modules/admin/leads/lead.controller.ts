import { FastifyRequest, FastifyReply } from 'fastify';
import { LeadService } from './lead.service.js';
import { z } from 'zod';
import { LeadStatus } from './lead.repository.js';

/**
 * Validation Schemas
 */
const listLeadsSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.string().optional(),
  city: z.string().optional(),
  search: z.string().optional(),
  hasWebsite: z
    .string()
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  minPotentialScore: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  pageSize: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(parseInt(val, 10), 100) : 20)),
});

const updateLeadSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  contactName: z.string().max(255).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(LeadStatus),
});

const getRecentLeadsSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(parseInt(val, 10), 50) : 10)),
});

const getHighPotentialSchema = z.object({
  minScore: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 70)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(parseInt(val, 10), 50) : 20)),
});

/**
 * Lead Controller
 */
export class LeadController {
  constructor(private leadService: LeadService) {}

  /**
   * List leads with filters
   * GET /api/v1/admin/leads
   */
  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listLeadsSchema.parse(request.query);

    const result = await this.leadService.list(query);

    return reply.send({
      success: true,
      ...result,
    });
  };

  /**
   * Get lead by ID
   * GET /api/v1/admin/leads/:id
   */
  getById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    const lead = await this.leadService.getById(id);

    return reply.send({
      success: true,
      data: lead,
    });
  };

  /**
   * Update lead
   * PUT /api/v1/admin/leads/:id
   */
  update = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const data = updateLeadSchema.parse(request.body);

    const lead = await this.leadService.update(id, data);

    return reply.send({
      success: true,
      data: lead,
      message: 'Lead updated successfully',
    });
  };

  /**
   * Update lead status
   * PATCH /api/v1/admin/leads/:id/status
   */
  updateStatus = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { status } = updateStatusSchema.parse(request.body);

    const lead = await this.leadService.updateStatus(id, status);

    return reply.send({
      success: true,
      data: lead,
      message: `Lead status updated to ${status}`,
    });
  };

  /**
   * Delete lead
   * DELETE /api/v1/admin/leads/:id
   */
  delete = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    const result = await this.leadService.delete(id);

    return reply.send(result);
  };

  /**
   * Get lead statistics
   * GET /api/v1/admin/leads/stats
   */
  getStats = async (_request: FastifyRequest, reply: FastifyReply) => {
    const stats = await this.leadService.getStats();

    return reply.send({
      success: true,
      data: stats,
    });
  };

  /**
   * Get recent leads
   * GET /api/v1/admin/leads/recent
   */
  getRecent = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = getRecentLeadsSchema.parse(request.query);

    const result = await this.leadService.getRecent(query.limit);

    return reply.send({
      success: true,
      ...result,
    });
  };

  /**
   * Get high potential leads
   * GET /api/v1/admin/leads/high-potential
   */
  getHighPotential = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = getHighPotentialSchema.parse(request.query);

    const result = await this.leadService.getHighPotential(query.minScore, query.limit);

    return reply.send({
      success: true,
      ...result,
    });
  };
}
