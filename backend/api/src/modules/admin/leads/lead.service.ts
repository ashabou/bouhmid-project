import { LeadRepository, UpdateLeadData, LeadStatus } from './lead.repository.js';
import { cacheService } from '@/shared/cache/cache.service.js';
import { NotFoundError, ValidationError } from '@/shared/errors/app.error.js';
import { logger } from '@/shared/logger/winston.config.js';

/**
 * Lead Service
 * Business logic for lead management with caching
 */
export class LeadService {
  constructor(private leadRepository: LeadRepository) {}

  /**
   * List leads with filters and pagination
   */
  async list(filters: {
    status?: LeadStatus;
    source?: string;
    city?: string;
    search?: string;
    hasWebsite?: boolean;
    minPotentialScore?: number;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const { leads, total } = await this.leadRepository.findMany({
      status: filters.status,
      source: filters.source,
      city: filters.city,
      search: filters.search,
      hasWebsite: filters.hasWebsite,
      minPotentialScore: filters.minPotentialScore,
      skip,
      take: pageSize,
    });

    return {
      data: leads,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Get lead by ID
   */
  async getById(id: string) {
    const lead = await this.leadRepository.findById(id);

    if (!lead) {
      throw new NotFoundError(`Lead with ID ${id} not found`);
    }

    return lead;
  }

  /**
   * Update lead
   */
  async update(id: string, data: UpdateLeadData) {
    // Verify lead exists
    const existingLead = await this.leadRepository.findById(id);
    if (!existingLead) {
      throw new NotFoundError(`Lead with ID ${id} not found`);
    }

    // Validate email format if provided
    if (data.email && !this.isValidEmail(data.email)) {
      throw new ValidationError('Invalid email format');
    }

    // Update lead
    const lead = await this.leadRepository.update(id, data);

    // Invalidate lead caches
    await this.invalidateLeadCaches();

    logger.info('Lead updated via admin', {
      leadId: id,
      changedFields: Object.keys(data),
    });

    return lead;
  }

  /**
   * Update lead status
   */
  async updateStatus(id: string, status: LeadStatus) {
    // Verify lead exists
    const existingLead = await this.leadRepository.findById(id);
    if (!existingLead) {
      throw new NotFoundError(`Lead with ID ${id} not found`);
    }

    // Validate status transition
    this.validateStatusTransition(existingLead.status, status);

    // Update status
    const lead = await this.leadRepository.updateStatus(id, status);

    // Invalidate lead caches
    await this.invalidateLeadCaches();

    logger.info('Lead status updated via admin', {
      leadId: id,
      oldStatus: existingLead.status,
      newStatus: status,
    });

    return lead;
  }

  /**
   * Delete lead
   */
  async delete(id: string) {
    // Verify lead exists
    const existingLead = await this.leadRepository.findById(id);
    if (!existingLead) {
      throw new NotFoundError(`Lead with ID ${id} not found`);
    }

    // Delete lead
    await this.leadRepository.delete(id);

    // Invalidate lead caches
    await this.invalidateLeadCaches();

    logger.info('Lead deleted via admin', { leadId: id });

    return { success: true, message: 'Lead deleted successfully' };
  }

  /**
   * Get lead statistics
   */
  async getStats() {
    const cacheKey = 'leads:stats';

    // Check cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Lead stats cache hit');
      return cached;
    }

    const stats = await this.leadRepository.getStats();

    // Cache for 10 minutes
    await cacheService.set(cacheKey, stats, 600);

    return stats;
  }

  /**
   * Get recent leads
   */
  async getRecent(limit = 10) {
    if (limit > 50) {
      throw new ValidationError('Limit cannot exceed 50');
    }

    const leads = await this.leadRepository.getRecent(limit);

    return {
      data: leads,
      count: leads.length,
    };
  }

  /**
   * Get high potential leads
   */
  async getHighPotential(minScore = 70, limit = 20) {
    if (limit > 50) {
      throw new ValidationError('Limit cannot exceed 50');
    }

    if (minScore < 0 || minScore > 100) {
      throw new ValidationError('Min score must be between 0 and 100');
    }

    const leads = await this.leadRepository.getHighPotential(minScore, limit);

    return {
      data: leads,
      count: leads.length,
      minScore,
    };
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(currentStatus: LeadStatus, newStatus: LeadStatus) {
    // Define valid transitions
    const validTransitions: Record<LeadStatus, LeadStatus[]> = {
      [LeadStatus.NEW]: [LeadStatus.CONTACTED, LeadStatus.REJECTED],
      [LeadStatus.CONTACTED]: [LeadStatus.QUALIFIED, LeadStatus.REJECTED],
      [LeadStatus.QUALIFIED]: [LeadStatus.CONVERTED, LeadStatus.REJECTED],
      [LeadStatus.CONVERTED]: [], // Terminal state
      [LeadStatus.REJECTED]: [], // Terminal state
    };

    const allowedNextStatuses = validTransitions[currentStatus];

    if (!allowedNextStatuses.includes(newStatus)) {
      throw new ValidationError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Invalidate all lead-related caches
   */
  private async invalidateLeadCaches() {
    try {
      await cacheService.invalidate('leads:*');
      await cacheService.invalidate('dashboard:*'); // Dashboard includes lead stats

      logger.debug('Lead caches invalidated');
    } catch (error) {
      logger.error('Failed to invalidate lead caches', { error });
      // Don't throw - cache invalidation failure should not block operations
    }
  }
}
