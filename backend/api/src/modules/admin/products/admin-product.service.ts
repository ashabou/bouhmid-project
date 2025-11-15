import { AdminProductRepository, CreateProductData, UpdateProductData } from './admin-product.repository.js';
import { cacheService } from '@/shared/cache/cache.service.js';
import { logger } from '@/shared/logger/winston.config.js';
import { NotFoundError, ConflictError } from '@/shared/errors/app.error.js';

type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED' | 'OUT_OF_STOCK';

/**
 * Admin Product Service
 * Business logic for product management with cache invalidation
 */
export class AdminProductService {
  constructor(private repository: AdminProductRepository) {}

  /**
   * Create a new product
   * Invalidates product list cache
   */
  async create(data: CreateProductData, userId: string) {
    // Validate SKU uniqueness
    const skuExists = await this.repository.skuExists(data.sku);
    if (skuExists) {
      throw new ConflictError(`Product with SKU "${data.sku}" already exists`);
    }

    // Validate slug uniqueness
    const slugExists = await this.repository.slugExists(data.slug);
    if (slugExists) {
      throw new ConflictError(`Product with slug "${data.slug}" already exists`);
    }

    // Create product
    const product = await this.repository.create(data, userId);

    // Invalidate caches
    await this.invalidateProductCaches();

    logger.info('Product created and caches invalidated', {
      productId: product.id,
      sku: product.sku,
    });

    return product;
  }

  /**
   * Update existing product
   * Invalidates related caches
   */
  async update(id: string, data: UpdateProductData, userId: string) {
    // Check if product exists
    const existingProduct = await this.repository.findById(id);
    if (!existingProduct) {
      throw new NotFoundError(`Product not found: ${id}`);
    }

    // Validate SKU uniqueness if SKU is being updated
    if (data.sku && data.sku !== existingProduct.sku) {
      const skuExists = await this.repository.skuExists(data.sku, id);
      if (skuExists) {
        throw new ConflictError(`Product with SKU "${data.sku}" already exists`);
      }
    }

    // Validate slug uniqueness if slug is being updated
    if (data.slug && data.slug !== existingProduct.slug) {
      const slugExists = await this.repository.slugExists(data.slug, id);
      if (slugExists) {
        throw new ConflictError(`Product with slug "${data.slug}" already exists`);
      }
    }

    // Update product
    const product = await this.repository.update(id, data, userId);

    // Invalidate caches (including old slug if changed)
    await this.invalidateProductCaches(existingProduct.slug);
    if (data.slug && data.slug !== existingProduct.slug) {
      await this.invalidateProductCache(data.slug, id);
    } else {
      await this.invalidateProductCache(existingProduct.slug, id);
    }

    logger.info('Product updated and caches invalidated', {
      productId: id,
      updatedFields: Object.keys(data),
    });

    return product;
  }

  /**
   * Delete product (soft delete)
   */
  async delete(id: string, userId: string) {
    // Check if product exists
    const existingProduct = await this.repository.findById(id);
    if (!existingProduct) {
      throw new NotFoundError(`Product not found: ${id}`);
    }

    // Soft delete
    await this.repository.delete(id, userId);

    // Invalidate caches
    await this.invalidateProductCaches(existingProduct.slug);
    await this.invalidateProductCache(existingProduct.slug, id);

    logger.info('Product deleted and caches invalidated', {
      productId: id,
    });

    return { success: true, message: 'Product deleted successfully' };
  }

  /**
   * Hard delete product (permanent)
   * Only for admin cleanup - use with caution
   */
  async hardDelete(id: string, userId: string) {
    // Check if product exists
    const existingProduct = await this.repository.findById(id);
    if (!existingProduct) {
      throw new NotFoundError(`Product not found: ${id}`);
    }

    // Hard delete
    await this.repository.hardDelete(id, userId);

    // Invalidate caches
    await this.invalidateProductCaches(existingProduct.slug);
    await this.invalidateProductCache(existingProduct.slug, id);

    logger.warn('Product permanently deleted and caches invalidated', {
      productId: id,
    });

    return { success: true, message: 'Product permanently deleted' };
  }

  /**
   * Get product by ID
   */
  async getById(id: string) {
    const product = await this.repository.findById(id);

    if (!product) {
      throw new NotFoundError(`Product not found: ${id}`);
    }

    return product;
  }

  /**
   * List products with filters
   */
  async list(filters: {
    status?: ProductStatus;
    categoryId?: number;
    brandId?: number;
    search?: string;
    inStock?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters.page || 1;
    const pageSize = Math.min(filters.pageSize || 20, 100); // Max 100 per page

    const result = await this.repository.findMany({
      status: filters.status,
      categoryId: filters.categoryId,
      brandId: filters.brandId,
      search: filters.search,
      inStock: filters.inStock,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return result;
  }

  /**
   * Invalidate all product-related caches
   */
  private async invalidateProductCaches(oldSlug?: string) {
    try {
      // Invalidate product list caches
      await cacheService.invalidatePattern('products:list:*');

      // Invalidate search caches
      await cacheService.invalidatePattern('search:*');

      // Invalidate filter aggregations
      await cacheService.invalidatePattern('search:aggregations:*');

      // Invalidate old slug cache if provided
      if (oldSlug) {
        await cacheService.del(`product:slug:${oldSlug}`);
      }

      logger.debug('Product list caches invalidated');
    } catch (error) {
      logger.error('Failed to invalidate product caches', { error });
      // Don't throw - cache invalidation failure shouldn't block the operation
    }
  }

  /**
   * Invalidate specific product cache
   */
  private async invalidateProductCache(slug: string, id: string) {
    try {
      await cacheService.del(`product:slug:${slug}`);
      await cacheService.del(`product:id:${id}`);

      logger.debug('Product cache invalidated', { slug, id });
    } catch (error) {
      logger.error('Failed to invalidate product cache', { error, slug, id });
      // Don't throw - cache invalidation failure shouldn't block the operation
    }
  }
}
