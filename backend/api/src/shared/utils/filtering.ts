/**
 * Product filter parameters
 */
export interface ProductFilters {
  brandId?: number;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  status?: string;
  search?: string;
}

/**
 * Build Prisma where clause for product filtering
 */
export function buildProductFilters(filters: ProductFilters): any {
  const where: any = {};

  // Brand filter
  if (filters.brandId) {
    where.brandId = filters.brandId;
  }

  // Category filter
  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  // Price range filter
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.currentPrice = {};
    if (filters.minPrice !== undefined) {
      where.currentPrice.gte = filters.minPrice;
    }
    if (filters.maxPrice !== undefined) {
      where.currentPrice.lte = filters.maxPrice;
    }
  }

  // Stock filter
  if (filters.inStock !== undefined) {
    where.inStock = filters.inStock;
  }

  // Status filter
  if (filters.status) {
    where.status = filters.status as any;
  }

  // Search filter (full-text search)
  if (filters.search) {
    where.OR = [
      {
        name: {
          contains: filters.search,
          mode: 'insensitive',
        },
      },
      {
        description: {
          contains: filters.search,
          mode: 'insensitive',
        },
      },
      {
        sku: {
          contains: filters.search,
          mode: 'insensitive',
        },
      },
      {
        partNumber: {
          contains: filters.search,
          mode: 'insensitive',
        },
      },
    ];
  }

  return where;
}

/**
 * Parse filter query params
 */
export function parseProductFilters(query: any): ProductFilters {
  return {
    brandId: query.brandId ? parseInt(query.brandId, 10) : undefined,
    categoryId: query.categoryId ? parseInt(query.categoryId, 10) : undefined,
    minPrice: query.minPrice ? parseFloat(query.minPrice) : undefined,
    maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : undefined,
    inStock: query.inStock === 'true' ? true : query.inStock === 'false' ? false : undefined,
    status: query.status || undefined,
    search: query.search || undefined,
  };
}
