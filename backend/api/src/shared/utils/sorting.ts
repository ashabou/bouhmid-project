import { Prisma } from '@prisma/client';

/**
 * Sort parameters
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Allowed sort fields for products
 */
const ALLOWED_PRODUCT_SORT_FIELDS = [
  'name',
  'currentPrice',
  'createdAt',
  'viewCount',
  'orderCount',
] as const;

type AllowedProductSortField = typeof ALLOWED_PRODUCT_SORT_FIELDS[number];

/**
 * Build Prisma orderBy clause for product sorting
 */
export function buildProductSort(params: SortParams): Prisma.ProductOrderByWithRelationInput {
  const { sortBy = 'createdAt', sortOrder = 'desc' } = params;

  // Validate sort field
  const field = ALLOWED_PRODUCT_SORT_FIELDS.includes(sortBy as any)
    ? (sortBy as AllowedProductSortField)
    : 'createdAt';

  return {
    [field]: sortOrder,
  };
}

/**
 * Parse sort query params
 */
export function parseSortParams(query: any): SortParams {
  return {
    sortBy: query.sortBy || 'createdAt',
    sortOrder: query.sortOrder === 'asc' ? 'asc' : 'desc',
  };
}
