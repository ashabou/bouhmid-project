import { BrandRepository } from './brand.repository.js';
import { cacheService } from '@/shared/cache/cache.service.js';
import { NotFoundError } from '@/shared/errors/app.error.js';
import { logger } from '@/shared/logger/winston.config.js';

export class BrandService {
  constructor(private brandRepository: BrandRepository) {}

  /**
   * List all brands with caching
   */
  async list(isActive?: boolean) {
    const cacheKey = `brands:list:${isActive ?? 'all'}`;

    // Check cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached brand list', { cacheKey });
      return cached;
    }

    // Query database
    const brands = await this.brandRepository.findAll(isActive);

    // Transform response to include product count
    const response = {
      data: brands.map((brand: any) => ({
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        logoUrl: brand.logoUrl,
        description: brand.description,
        countryOfOrigin: brand.countryOfOrigin,
        isActive: brand.isActive,
        productCount: brand._count.products,
        createdAt: brand.createdAt,
        updatedAt: brand.updatedAt,
      })),
    };

    // Cache for 1 hour (brands change infrequently)
    await cacheService.set(cacheKey, response, 3600);

    logger.info('Brand list queried', { count: brands.length });

    return response;
  }

  /**
   * Get brand by slug with products
   */
  async getBySlug(slug: string) {
    const cacheKey = `brand:slug:${slug}`;

    // Check cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached brand', { slug });
      return cached;
    }

    // Query database
    const brand = await this.brandRepository.findBySlugWithProducts(slug);
    if (!brand) {
      throw new NotFoundError(`Brand not found: ${slug}`);
    }

    const response = {
      ...brand,
      productCount: brand._count.products,
      _count: undefined,
    };

    // Cache for 30 minutes
    await cacheService.set(cacheKey, response, 1800);

    logger.info('Brand viewed', { slug, brandId: brand.id });

    return response;
  }
}
