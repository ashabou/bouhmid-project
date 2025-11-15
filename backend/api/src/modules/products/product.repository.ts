import { prisma } from '@/shared/database/client.js';
import { buildCursorPagination } from '@/shared/utils/pagination.js';
import { buildProductFilters, ProductFilters } from '@/shared/utils/filtering.js';
import { buildProductSort, SortParams } from '@/shared/utils/sorting.js';

export class ProductRepository {
  /**
   * Find many products with filters, sorting, and pagination
   */
  async findMany(
    filters: ProductFilters,
    sort: SortParams,
    pagination: { cursor?: string; limit: number }
  ) {
    const where = buildProductFilters(filters);
    const orderBy = buildProductSort(sort);
    const paginationQuery = buildCursorPagination(pagination);

    return prisma.product.findMany({
      where,
      orderBy,
      ...paginationQuery,
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
  }

  /**
   * Find product by slug with full details
   */
  async findBySlug(slug: string) {
    return prisma.product.findUnique({
      where: { slug },
      include: {
        brand: true,
        category: true,
        priceHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  /**
   * Find product by ID
   */
  async findById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        category: true,
      },
    });
  }

  /**
   * Increment view count asynchronously
   */
  async incrementViewCount(id: string) {
    return prisma.product.update({
      where: { id },
      data: {
        viewCount: {
          increment: 1,
        },
      },
    });
  }

  /**
   * Get related products in same category
   */
  async getRelatedProducts(productId: string, categoryId: number, limit = 4) {
    return prisma.product.findMany({
      where: {
        categoryId,
        id: { not: productId },
        status: 'ACTIVE',
      },
      take: limit,
      orderBy: {
        viewCount: 'desc',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        currentPrice: true,
        primaryImageUrl: true,
        inStock: true,
        brand: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  /**
   * Count products matching filters
   */
  async count(filters: ProductFilters): Promise<number> {
    const where = buildProductFilters(filters);
    return prisma.product.count({ where });
  }

  /**
   * Check if product exists by slug
   */
  async existsBySlug(slug: string): Promise<boolean> {
    const count = await prisma.product.count({ where: { slug } });
    return count > 0;
  }

  /**
   * Check if product exists by SKU
   */
  async existsBySku(sku: string): Promise<boolean> {
    const count = await prisma.product.count({ where: { sku } });
    return count > 0;
  }
}
