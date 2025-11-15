import { ProductRepository } from './product.repository.js';
import { cacheService } from '@/shared/cache/cache.service.js';
import { formatPaginatedResponse } from '@/shared/utils/pagination.js';
import { ProductFilters } from '@/shared/utils/filtering.js';
import { SortParams } from '@/shared/utils/sorting.js';
import { NotFoundError } from '@/shared/errors/app.error.js';
import { logger } from '@/shared/logger/winston.config.js';

export class ProductService {
  constructor(private productRepository: ProductRepository) {}

  /**
   * List products with caching
   */
  async list(filters: ProductFilters, sort: SortParams, pagination: { cursor?: string; limit: number }) {
    // Generate cache key
    const cacheKey = cacheService.generateKey('products:list', {
      filters,
      sort,
      pagination,
    });

    // Check cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached product list', { cacheKey });
      return cached;
    }

    // Query database
    const products = await this.productRepository.findMany(filters, sort, pagination);

    // Format response
    const response = formatPaginatedResponse(products, pagination.limit);

    // Cache for 5 minutes
    await cacheService.set(cacheKey, response, 300);

    logger.info('Product list queried', {
      filters,
      count: response.data.length,
      hasMore: response.pagination.hasMore,
    });

    return response;
  }

  /**
   * Get product by slug with caching
   */
  async getBySlug(slug: string) {
    // Check cache
    const cacheKey = `product:slug:${slug}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached product', { slug });
      return cached;
    }

    // Query database
    const product = await this.productRepository.findBySlug(slug);
    if (!product) {
      throw new NotFoundError(`Product not found: ${slug}`);
    }

    // Get related products
    const relatedProducts = await this.productRepository.getRelatedProducts(
      product.id,
      product.categoryId
    );

    const response = {
      ...product,
      relatedProducts,
    };

    // Cache for 10 minutes
    await cacheService.set(cacheKey, response, 600);

    // Increment view count asynchronously (don't await)
    this.productRepository.incrementViewCount(product.id).catch((err) => {
      logger.error('Failed to increment view count', { productId: product.id, error: err });
    });

    logger.info('Product viewed', { slug, productId: product.id });

    return response;
  }

  /**
   * Get product by ID
   */
  async getById(id: string) {
    const cacheKey = `product:id:${id}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundError(`Product not found: ${id}`);
    }

    await cacheService.set(cacheKey, product, 600);
    return product;
  }
}
