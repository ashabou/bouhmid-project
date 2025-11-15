import { AdminBrandRepository, CreateBrandData, UpdateBrandData } from './admin-brand.repository.js';
import { cacheService } from '@/shared/cache/cache.service.js';
import { logger } from '@/shared/logger/winston.config.js';
import { NotFoundError, ConflictError } from '@/shared/errors/app.error.js';

/**
 * Admin Brand Service
 * Business logic for brand management with cache invalidation
 */
export class AdminBrandService {
  constructor(private repository: AdminBrandRepository) {}

  /**
   * Create a new brand
   * Invalidates brand list cache
   */
  async create(data: CreateBrandData) {
    // Validate name uniqueness
    const nameExists = await this.repository.nameExists(data.name);
    if (nameExists) {
      throw new ConflictError(`Brand with name "${data.name}" already exists`);
    }

    // Validate slug uniqueness
    const slugExists = await this.repository.slugExists(data.slug);
    if (slugExists) {
      throw new ConflictError(`Brand with slug "${data.slug}" already exists`);
    }

    // Create brand
    const brand = await this.repository.create(data);

    // Invalidate caches
    await this.invalidateBrandCaches();

    logger.info('Brand created and caches invalidated', {
      brandId: brand.id,
      name: brand.name,
    });

    return brand;
  }

  /**
   * Update existing brand
   * Invalidates related caches
   */
  async update(id: number, data: UpdateBrandData) {
    // Check if brand exists
    const existingBrand = await this.repository.findById(id);
    if (!existingBrand) {
      throw new NotFoundError(`Brand not found: ${id}`);
    }

    // Validate name uniqueness if name is being updated
    if (data.name && data.name !== existingBrand.name) {
      const nameExists = await this.repository.nameExists(data.name, id);
      if (nameExists) {
        throw new ConflictError(`Brand with name "${data.name}" already exists`);
      }
    }

    // Validate slug uniqueness if slug is being updated
    if (data.slug && data.slug !== existingBrand.slug) {
      const slugExists = await this.repository.slugExists(data.slug, id);
      if (slugExists) {
        throw new ConflictError(`Brand with slug "${data.slug}" already exists`);
      }
    }

    // Update brand
    const brand = await this.repository.update(id, data);

    // Invalidate caches (including old slug if changed)
    await this.invalidateBrandCaches(existingBrand.slug);
    if (data.slug && data.slug !== existingBrand.slug) {
      await this.invalidateBrandCache(data.slug, id);
    } else {
      await this.invalidateBrandCache(existingBrand.slug, id);
    }

    logger.info('Brand updated and caches invalidated', {
      brandId: id,
      updatedFields: Object.keys(data),
    });

    return brand;
  }

  /**
   * Delete brand (soft delete)
   * Only allowed if no products are associated
   */
  async delete(id: number) {
    // Check if brand exists
    const existingBrand = await this.repository.findById(id);
    if (!existingBrand) {
      throw new NotFoundError(`Brand not found: ${id}`);
    }

    // Soft delete (repository will check for product dependencies)
    await this.repository.delete(id);

    // Invalidate caches
    await this.invalidateBrandCaches(existingBrand.slug);
    await this.invalidateBrandCache(existingBrand.slug, id);

    logger.info('Brand deleted and caches invalidated', {
      brandId: id,
    });

    return { success: true, message: 'Brand deleted successfully' };
  }

  /**
   * Hard delete brand (permanent)
   * Only allowed if no products are associated
   * Use with caution - only for admin cleanup
   */
  async hardDelete(id: number) {
    // Check if brand exists
    const existingBrand = await this.repository.findById(id);
    if (!existingBrand) {
      throw new NotFoundError(`Brand not found: ${id}`);
    }

    // Hard delete (repository will check for product dependencies)
    await this.repository.hardDelete(id);

    // Invalidate caches
    await this.invalidateBrandCaches(existingBrand.slug);
    await this.invalidateBrandCache(existingBrand.slug, id);

    logger.warn('Brand permanently deleted and caches invalidated', {
      brandId: id,
    });

    return { success: true, message: 'Brand permanently deleted' };
  }

  /**
   * Get brand by ID
   */
  async getById(id: number) {
    const brand = await this.repository.findById(id);

    if (!brand) {
      throw new NotFoundError(`Brand not found: ${id}`);
    }

    return brand;
  }

  /**
   * List brands with filters
   */
  async list(filters: {
    isActive?: boolean;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters.page || 1;
    const pageSize = Math.min(filters.pageSize || 20, 100); // Max 100 per page

    const result = await this.repository.findMany({
      isActive: filters.isActive,
      search: filters.search,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return result;
  }

  /**
   * Invalidate all brand-related caches
   */
  private async invalidateBrandCaches(oldSlug?: string) {
    try {
      // Invalidate brand list caches
      await cacheService.invalidatePattern('brands:list:*');

      // Invalidate product caches (since brand info is included in product responses)
      await cacheService.invalidatePattern('products:*');

      // Invalidate search caches
      await cacheService.invalidatePattern('search:*');

      // Invalidate old slug cache if provided
      if (oldSlug) {
        await cacheService.del(`brand:slug:${oldSlug}`);
      }

      logger.debug('Brand list caches invalidated');
    } catch (error) {
      logger.error('Failed to invalidate brand caches', { error });
      // Don't throw - cache invalidation failure shouldn't block the operation
    }
  }

  /**
   * Invalidate specific brand cache
   */
  private async invalidateBrandCache(slug: string, id: number) {
    try {
      await cacheService.del(`brand:slug:${slug}`);
      await cacheService.del(`brand:id:${id}`);

      logger.debug('Brand cache invalidated', { slug, id });
    } catch (error) {
      logger.error('Failed to invalidate brand cache', { error, slug, id });
      // Don't throw - cache invalidation failure shouldn't block the operation
    }
  }
}
