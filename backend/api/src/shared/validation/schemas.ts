import { z } from 'zod';

/**
 * Zod validation schemas for API requests
 */

// Product list query schema
export const listProductsSchema = z.object({
  // Pagination
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  // Sorting
  sortBy: z.enum(['name', 'currentPrice', 'createdAt', 'viewCount', 'orderCount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  // Filters
  brandId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  inStock: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  status: z.string().optional(),
  search: z.string().min(1).max(100).optional(),
});

export type ListProductsQuery = z.infer<typeof listProductsSchema>;

// Product slug param schema
export const productSlugSchema = z.object({
  slug: z.string().min(1).max(500),
});

// Login schema
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Create product schema
export const createProductSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(500),
  slug: z.string().min(1).max(500),
  brandId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive(),
  description: z.string().optional(),
  specifications: z.record(z.any()).optional(),
  currentPrice: z.number().positive(),
  originalPrice: z.number().positive().optional(),
  currency: z.string().length(3).default('TND'),
  inStock: z.boolean().default(true),
  stockQuantity: z.number().int().min(0).default(0),
  images: z.array(z.string()).optional(),
  primaryImageUrl: z.string().url().optional(),
  metaTitle: z.string().max(255).optional(),
  metaDescription: z.string().max(500).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK']).default('ACTIVE'),
  compatibleVehicles: z.record(z.any()).optional(),
  partNumber: z.string().max(100).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

// Update product schema
export const updateProductSchema = createProductSchema.partial();

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Brand schemas
export const createBrandSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  logoUrl: z.string().url().optional(),
  description: z.string().optional(),
  countryOfOrigin: z.string().max(100).optional(),
  isActive: z.boolean().default(true),
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>;

export const updateBrandSchema = createBrandSchema.partial();

export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;

// Category schemas
export const createCategorySchema = z.object({
  parentId: z.number().int().positive().optional(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  level: z.number().int().min(0).max(3).default(0),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
