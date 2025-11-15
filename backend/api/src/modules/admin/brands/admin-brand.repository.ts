import { prisma } from '@/shared/database/client.js';
import { logger } from '@/shared/logger/winston.config.js';

export interface CreateBrandData {
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  countryOfOrigin?: string;
  isActive?: boolean;
}

export interface UpdateBrandData {
  name?: string;
  slug?: string;
  logoUrl?: string | null;
  description?: string | null;
  countryOfOrigin?: string | null;
  isActive?: boolean;
}

/**
 * Admin Brand Repository
 * Handles CRUD operations for brand management
 */
export class AdminBrandRepository {
  /**
   * Create a new brand
   */
  async create(data: CreateBrandData) {
    try {
      const brand = await prisma.brand.create({
        data: {
          name: data.name,
          slug: data.slug,
          logoUrl: data.logoUrl || null,
          description: data.description || null,
          countryOfOrigin: data.countryOfOrigin || null,
          isActive: data.isActive ?? true,
        },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      logger.info('Brand created', {
        brandId: brand.id,
        name: brand.name,
        slug: brand.slug,
      });

      return brand;
    } catch (error) {
      logger.error('Failed to create brand', { error, data });
      throw error;
    }
  }

  /**
   * Update existing brand
   */
  async update(id: number, data: UpdateBrandData) {
    try {
      const brand = await prisma.brand.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.slug && { slug: data.slug }),
          ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl || null }),
          ...(data.description !== undefined && { description: data.description || null }),
          ...(data.countryOfOrigin !== undefined && {
            countryOfOrigin: data.countryOfOrigin || null,
          }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      });

      logger.info('Brand updated', {
        brandId: id,
        changedFields: Object.keys(data),
      });

      return brand;
    } catch (error) {
      logger.error('Failed to update brand', { error, id, data });
      throw error;
    }
  }

  /**
   * Delete brand (soft delete by setting isActive to false)
   * Only allowed if brand has no associated products
   */
  async delete(id: number) {
    try {
      // Check for associated products
      const productCount = await prisma.product.count({
        where: { brandId: id },
      });

      if (productCount > 0) {
        throw new Error(
          `Cannot delete brand: ${productCount} product(s) are associated with this brand. Please reassign or delete products first.`
        );
      }

      // Soft delete: set isActive to false
      const brand = await prisma.brand.update({
        where: { id },
        data: {
          isActive: false,
        },
      });

      logger.info('Brand deleted (soft)', {
        brandId: id,
        name: brand.name,
      });

      return brand;
    } catch (error) {
      logger.error('Failed to delete brand', { error, id });
      throw error;
    }
  }

  /**
   * Hard delete brand (permanent deletion)
   * Only allowed if brand has no associated products
   * Use with caution - only for admin cleanup
   */
  async hardDelete(id: number) {
    try {
      // Check for associated products
      const productCount = await prisma.product.count({
        where: { brandId: id },
      });

      if (productCount > 0) {
        throw new Error(
          `Cannot delete brand: ${productCount} product(s) are associated with this brand. Please reassign or delete products first.`
        );
      }

      // Hard delete
      await prisma.brand.delete({
        where: { id },
      });

      logger.warn('Brand hard deleted (permanent)', {
        brandId: id,
      });

      return { id, deleted: true };
    } catch (error) {
      logger.error('Failed to hard delete brand', { error, id });
      throw error;
    }
  }

  /**
   * Get brand by ID (admin view with product count)
   */
  async findById(id: number) {
    return prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  /**
   * List all brands (admin view with filters)
   */
  async findMany(filters: {
    isActive?: boolean;
    search?: string;
    skip?: number;
    take?: number;
  }) {
    const where: any = {};

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
        { countryOfOrigin: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [brands, total] = await Promise.all([
      prisma.brand.findMany({
        where,
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        skip: filters.skip || 0,
        take: filters.take || 20,
      }),
      prisma.brand.count({ where }),
    ]);

    return {
      data: brands,
      total,
      page: Math.floor((filters.skip || 0) / (filters.take || 20)) + 1,
      pageSize: filters.take || 20,
      totalPages: Math.ceil(total / (filters.take || 20)),
    };
  }

  /**
   * Check if brand name exists
   */
  async nameExists(name: string, excludeId?: number): Promise<boolean> {
    const brand = await prisma.brand.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });

    if (!brand) return false;
    if (excludeId && brand.id === excludeId) return false;
    return true;
  }

  /**
   * Check if slug exists
   */
  async slugExists(slug: string, excludeId?: number): Promise<boolean> {
    const brand = await prisma.brand.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!brand) return false;
    if (excludeId && brand.id === excludeId) return false;
    return true;
  }
}
