/**
 * API Type Definitions for Frontend
 * Auto-generated types from Prisma models and API responses
 *
 * Usage in frontend:
 * import type { Product, Brand, Category } from '@shabou-autopieces/api-types';
 */

// ========================================
// Base Models (from Prisma)
// ========================================

export interface Product {
  id: string;
  reference: string;
  name: string;
  description: string | null;
  barcode: string | null;
  price: number;
  stock: number;
  minStock: number;
  imageUrl: string | null;
  viewCount: number;
  brandId: string;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
  brand?: Brand;
  category?: Category;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  parent?: Category | null;
  children?: Category[];
}

export interface Lead {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  source: 'GOOGLE_MAPS' | 'MANUAL' | 'IMPORT';
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'LOST' | 'CUSTOMER';
  notes: string | null;
  qualityScore: number | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PriceHistory {
  id: string;
  productId: string;
  price: number;
  effectiveDate: string;
  createdAt: string;
  product?: Product;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'VIEWER';
  createdAt: string;
  updatedAt: string;
}

// ========================================
// API Request Types
// ========================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateProductRequest {
  reference: string;
  name: string;
  description?: string;
  barcode?: string;
  price: number;
  stock: number;
  minStock: number;
  imageUrl?: string;
  brandId: string;
  categoryId: string;
}

export interface UpdateProductRequest {
  reference?: string;
  name?: string;
  description?: string;
  barcode?: string;
  price?: number;
  stock?: number;
  minStock?: number;
  imageUrl?: string;
  brandId?: string;
  categoryId?: string;
}

export interface CreateBrandRequest {
  name: string;
  description?: string;
  logoUrl?: string;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  parentId?: string;
}

export interface SearchQuery {
  q?: string;
  type?: 'text' | 'barcode' | 'reference';
  brandId?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  cursor?: string;
  limit?: number;
}

// ========================================
// API Response Types
// ========================================

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}

export interface ProductListResponse {
  data: Product[];
  meta: PaginationMeta;
}

export interface BrandListResponse {
  data: Brand[];
  meta: PaginationMeta;
}

export interface CategoryListResponse {
  data: Category[];
  meta: PaginationMeta;
}

export interface LeadListResponse {
  data: Lead[];
  meta: PaginationMeta;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface SearchResponse {
  data: Product[];
  meta: PaginationMeta;
  query: {
    term: string;
    type: string;
    filters: Record<string, any>;
  };
}

// ========================================
// Dashboard Types
// ========================================

export interface DashboardStats {
  products: {
    total: number;
    lowStock: number;
    outOfStock: number;
  };
  leads: {
    total: number;
    new: number;
    contacted: number;
    qualified: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    growth: number;
  };
  topProducts: Array<{
    id: string;
    name: string;
    viewCount: number;
    revenue: number;
  }>;
  recentActivity: Array<{
    type: 'product_created' | 'lead_added' | 'price_updated';
    message: string;
    timestamp: string;
  }>;
}

// ========================================
// Error Types
// ========================================

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, any>;
}

export interface ValidationError extends ApiError {
  statusCode: 400;
  error: 'Bad Request';
  validation: Array<{
    field: string;
    message: string;
  }>;
}

// ========================================
// Health Check
// ========================================

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
}

// ========================================
// Utility Types
// ========================================

export type ProductStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export type LeadSource = 'GOOGLE_MAPS' | 'MANUAL' | 'IMPORT';
export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'LOST' | 'CUSTOMER';
export type AdminRole = 'ADMIN' | 'MANAGER' | 'VIEWER';
export type SearchType = 'text' | 'barcode' | 'reference';

// ========================================
// Filter Types
// ========================================

export interface ProductFilters {
  brandId?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  search?: string;
}

export interface LeadFilters {
  status?: LeadStatus;
  source?: LeadSource;
  minQualityScore?: number;
  search?: string;
}

// ========================================
// Sort Types
// ========================================

export type SortOrder = 'asc' | 'desc';

export interface SortOptions {
  field: string;
  order: SortOrder;
}

// ========================================
// Bulk Operations
// ========================================

export interface BulkUpdateRequest<T> {
  ids: string[];
  data: Partial<T>;
}

export interface BulkDeleteRequest {
  ids: string[];
}

export interface BulkOperationResponse {
  success: boolean;
  updated: number;
  failed: number;
  errors?: Array<{
    id: string;
    error: string;
  }>;
}
