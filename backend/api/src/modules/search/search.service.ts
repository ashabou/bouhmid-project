import { prisma } from '@/shared/database/client.js';
import { cacheService } from '@/shared/cache/cache.service.js';
import { formatPaginatedResponse } from '@/shared/utils/pagination.js';
import { buildCursorPagination } from '@/shared/utils/pagination.js';
import { logger } from '@/shared/logger/winston.config.js';

export interface SearchParams {
  query: string;
  categoryId?: number;
  brandId?: number;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

export class SearchService {
  /**
   * Search products using PostgreSQL full-text search
   */
  async search(
    params: SearchParams,
    pagination: { cursor?: string; limit: number }
  ) {
    const { query, categoryId, brandId, minPrice, maxPrice, inStock } = params;

    // Generate cache key
    const cacheKey = cacheService.generateKey('search', { params, pagination });

    // Check cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached search results', { query });
      return cached;
    }

    // Build where clause
    const where: any = {
      status: 'ACTIVE',
    };

    // Full-text search
    if (query) {
      where.OR = [
        {
          name: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          sku: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          partNumber: {
            contains: query,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Additional filters
    if (categoryId !== undefined) {
      where.categoryId = categoryId;
    }

    if (brandId !== undefined) {
      where.brandId = brandId;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.currentPrice = {};
      if (minPrice !== undefined) {
        where.currentPrice.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.currentPrice.lte = maxPrice;
      }
    }

    if (inStock !== undefined) {
      where.inStock = inStock;
    }

    const paginationQuery = buildCursorPagination(pagination);

    // Query database
    const products = await prisma.product.findMany({
      where,
      ...paginationQuery,
      orderBy: [
        // Prioritize exact matches in name
        { name: 'asc' },
        { viewCount: 'desc' },
      ],
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    // Format response
    const response = formatPaginatedResponse(products, pagination.limit);

    // Cache for 5 minutes
    await cacheService.set(cacheKey, response, 300);

    logger.info('Search query executed', {
      query,
      filters: { categoryId, brandId, minPrice, maxPrice, inStock },
      resultsCount: response.data.length,
    });

    return response;
  }

  /**
   * Get search suggestions (autocomplete)
   */
  async getSuggestions(query: string, limit = 5) {
    const cacheKey = `search:suggestions:${query}`;

    // Check cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Query database for product names and SKUs
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            sku: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      take: limit,
      select: {
        name: true,
        slug: true,
        sku: true,
      },
      orderBy: {
        viewCount: 'desc',
      },
    });

    const response = {
      data: products.map((p: any) => ({
        name: p.name,
        slug: p.slug,
        sku: p.sku,
      })),
    };

    // Cache for 15 minutes
    await cacheService.set(cacheKey, response, 900);

    logger.debug('Search suggestions generated', { query, count: products.length });

    return response;
  }

  /**
   * Get filter aggregations for search results
   * Returns available brands, categories, and price ranges
   */
  async getFilterAggregations(params: SearchParams) {
    const { query, categoryId, brandId } = params;

    const cacheKey = cacheService.generateKey('search:aggregations', params);

    // Check cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Build base where clause
    const where: any = {
      status: 'ACTIVE',
    };

    if (query) {
      where.OR = [
        {
          name: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          sku: {
            contains: query,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Get brand aggregations (if not filtered by brand)
    let brands: any[] = [];
    if (!brandId) {
      brands = await prisma.product.groupBy({
        by: ['brandId'],
        where: { ...where, brandId: { not: null } },
        _count: {
          id: true,
        },
      });

      // Fetch brand details
      const brandIds = brands.map((b) => b.brandId).filter((id): id is number => id !== null);
      const brandDetails = await prisma.brand.findMany({
        where: { id: { in: brandIds } },
        select: { id: true, name: true, slug: true },
      });

      brands = brands.map((b: any) => {
        const detail = brandDetails.find((d: any) => d.id === b.brandId);
        return {
          id: b.brandId,
          name: detail?.name,
          slug: detail?.slug,
          count: b._count.id,
        };
      });
    }

    // Get category aggregations (if not filtered by category)
    let categories: any[] = [];
    if (!categoryId) {
      categories = await prisma.product.groupBy({
        by: ['categoryId'],
        where,
        _count: {
          id: true,
        },
      });

      // Fetch category details
      const categoryIds = categories.map((c) => c.categoryId);
      const categoryDetails = await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, slug: true },
      });

      categories = categories.map((c: any) => {
        const detail = categoryDetails.find((d: any) => d.id === c.categoryId);
        return {
          id: c.categoryId,
          name: detail?.name,
          slug: detail?.slug,
          count: c._count.id,
        };
      });
    }

    // Get price range
    const priceAggregation = await prisma.product.aggregate({
      where,
      _min: {
        currentPrice: true,
      },
      _max: {
        currentPrice: true,
      },
    });

    const response = {
      data: {
        brands,
        categories,
        priceRange: {
          min: priceAggregation._min.currentPrice || 0,
          max: priceAggregation._max.currentPrice || 0,
        },
      },
    };

    // Cache for 10 minutes
    await cacheService.set(cacheKey, response, 600);

    logger.debug('Filter aggregations generated', { query });

    return response;
  }
}
