/**
 * Pagination utilities
 * Implements cursor-based pagination for better performance with large datasets
 */

export interface PaginationParams {
  cursor?: string;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

/**
 * Build cursor pagination query for Prisma
 */
export function buildCursorPagination(params: PaginationParams) {
  const { cursor, limit } = params;

  return {
    take: limit + 1, // Fetch one extra to determine if there are more results
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  };
}

/**
 * Format paginated response
 * Extracts the extra item to determine hasMore and nextCursor
 */
export function formatPaginatedResponse<T extends { id: string }>(
  items: T[],
  limit: number
): PaginatedResponse<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return {
    data,
    pagination: {
      nextCursor,
      hasMore,
      limit,
    },
  };
}

/**
 * Parse pagination query params
 */
export function parsePaginationParams(query: any): PaginationParams {
  return {
    cursor: query.cursor || undefined,
    limit: Math.min(parseInt(query.limit || '20', 10), 100), // Max 100 items per page
  };
}
