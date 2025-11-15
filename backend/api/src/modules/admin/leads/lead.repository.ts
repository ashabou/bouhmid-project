import { prisma } from '@/shared/database/client.js';
import { logger } from '@/shared/logger/winston.config.js';

// Define LeadStatus enum (from Prisma schema)
export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  CONVERTED = 'CONVERTED',
  REJECTED = 'REJECTED',
}

export interface UpdateLeadData {
  status?: LeadStatus;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  contactedAt?: Date | null;
  qualifiedAt?: Date | null;
}

export interface LeadFilters {
  status?: LeadStatus;
  source?: string;
  city?: string;
  search?: string;
  hasWebsite?: boolean;
  minPotentialScore?: number;
  skip?: number;
  take?: number;
}

/**
 * Lead Repository
 * Handles lead data access and queries for admin management
 */
export class LeadRepository {
  /**
   * List leads with filters and pagination
   */
  async findMany(filters: LeadFilters) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.source) {
      where.source = filters.source;
    }

    if (filters.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    if (filters.hasWebsite !== undefined) {
      where.hasWebsite = filters.hasWebsite;
    }

    if (filters.minPotentialScore !== undefined) {
      where.potentialScore = { gte: filters.minPotentialScore };
    }

    if (filters.search) {
      where.OR = [
        { businessName: { contains: filters.search, mode: 'insensitive' } },
        { contactName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: [
          { potentialScore: 'desc' },
          { scrapedAt: 'desc' },
        ],
        skip: filters.skip || 0,
        take: filters.take || 20,
        include: {
          leadProducts: {
            select: {
              id: true,
              name: true,
              price: true,
              currency: true,
              brand: true,
            },
            take: 5,
          },
          _count: {
            select: {
              leadProducts: true,
            },
          },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return { leads, total };
  }

  /**
   * Find lead by ID
   */
  async findById(id: string) {
    return prisma.lead.findUnique({
      where: { id },
      include: {
        leadProducts: {
          orderBy: { scrapedAt: 'desc' },
          select: {
            id: true,
            name: true,
            price: true,
            currency: true,
            partNumber: true,
            brand: true,
            matchedProductId: true,
            priceDifference: true,
            scrapedAt: true,
          },
        },
        _count: {
          select: {
            leadProducts: true,
          },
        },
      },
    });
  }

  /**
   * Update lead
   */
  async update(id: string, data: UpdateLeadData) {
    try {
      const lead = await prisma.lead.update({
        where: { id },
        data: {
          ...(data.status && { status: data.status }),
          ...(data.contactName !== undefined && { contactName: data.contactName || null }),
          ...(data.phone !== undefined && { phone: data.phone || null }),
          ...(data.email !== undefined && { email: data.email || null }),
          ...(data.notes !== undefined && { notes: data.notes || null }),
          ...(data.contactedAt !== undefined && { contactedAt: data.contactedAt || null }),
          ...(data.qualifiedAt !== undefined && { qualifiedAt: data.qualifiedAt || null }),
        },
        include: {
          leadProducts: {
            select: {
              id: true,
              name: true,
              price: true,
              currency: true,
              brand: true,
            },
            take: 5,
          },
          _count: {
            select: {
              leadProducts: true,
            },
          },
        },
      });

      logger.info('Lead updated', {
        leadId: id,
        changedFields: Object.keys(data),
      });

      return lead;
    } catch (error) {
      logger.error('Failed to update lead', { error, id, data });
      throw error;
    }
  }

  /**
   * Update lead status
   */
  async updateStatus(id: string, status: LeadStatus) {
    try {
      const updateData: any = { status };

      // Auto-update timestamps based on status
      if (status === 'CONTACTED' || status === 'QUALIFIED') {
        updateData.contactedAt = new Date();
      }

      if (status === 'QUALIFIED') {
        updateData.qualifiedAt = new Date();
      }

      const lead = await prisma.lead.update({
        where: { id },
        data: updateData,
        include: {
          _count: {
            select: {
              leadProducts: true,
            },
          },
        },
      });

      logger.info('Lead status updated', {
        leadId: id,
        oldStatus: lead.status,
        newStatus: status,
      });

      return lead;
    } catch (error) {
      logger.error('Failed to update lead status', { error, id, status });
      throw error;
    }
  }

  /**
   * Delete lead
   */
  async delete(id: string) {
    try {
      await prisma.lead.delete({
        where: { id },
      });

      logger.info('Lead deleted', { leadId: id });

      return { id, deleted: true };
    } catch (error) {
      logger.error('Failed to delete lead', { error, id });
      throw error;
    }
  }

  /**
   * Get lead statistics
   */
  async getStats() {
    const [totalLeads, statusBreakdown, sourceBreakdown, topCities] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.lead.groupBy({
        by: ['source'],
        _count: { source: true },
      }),
      prisma.lead.groupBy({
        by: ['city'],
        _count: { city: true },
        orderBy: { _count: { city: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      total: totalLeads,
      byStatus: statusBreakdown.map((item: any) => ({
        status: item.status,
        count: item._count.status,
      })),
      bySource: sourceBreakdown.map((item: any) => ({
        source: item.source,
        count: item._count.source,
      })),
      topCities: topCities
        .filter((item: any) => item.city)
        .map((item: any) => ({
          city: item.city,
          count: item._count.city,
        })),
    };
  }

  /**
   * Get recent leads
   */
  async getRecent(limit = 10) {
    return prisma.lead.findMany({
      orderBy: { scrapedAt: 'desc' },
      take: limit,
      include: {
        _count: {
          select: {
            leadProducts: true,
          },
        },
      },
    });
  }

  /**
   * Get high potential leads
   */
  async getHighPotential(minScore = 70, limit = 20) {
    return prisma.lead.findMany({
      where: {
        potentialScore: { gte: minScore },
        status: { in: ['NEW', 'CONTACTED'] },
      },
      orderBy: { potentialScore: 'desc' },
      take: limit,
      include: {
        _count: {
          select: {
            leadProducts: true,
          },
        },
      },
    });
  }
}
