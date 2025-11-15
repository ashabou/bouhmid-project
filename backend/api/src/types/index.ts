/**
 * Shabou Auto Pièces - API Type Definitions
 * Export all API types for frontend consumption
 */

export * from './api-types.js';

// Re-export commonly used types for convenience
export type {
  Product,
  Brand,
  Category,
  Lead,
  AdminUser,
  LoginRequest,
  LoginResponse,
  ApiResponse,
  PaginationMeta,
  ApiError,
  HealthResponse,
  DashboardStats,
  SearchResponse,
  ProductListResponse,
  BrandListResponse,
  CategoryListResponse,
  LeadListResponse,
} from './api-types.js';
