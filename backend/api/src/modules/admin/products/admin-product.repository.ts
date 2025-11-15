import { prisma } from '@/shared/database/client.js';
import { Prisma } from '@prisma/client';
import { logger } from '@/shared/logger/winston.config.js';

type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED' | 'OUT_OF_STOCK';

export interface CreateProductData {
  sku: string;
  name: string;
  slug: string;
  brandId?: number;
  categoryId: number;
  description?: string;
  specifications?: any;
  currentPrice: number;
  originalPrice?: number;
  currency?: string;
  inStock?: boolean;
  stockQuantity?: number;
  images?: any;
  primaryImageUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  status?: ProductStatus;
  compatibleVehicles?: any;
  partNumber?: string;
}

export interface UpdateProductData {
  sku?: string;
  name?: string;
  slug?: string;
  brandId?: number | null;
  categoryId?: number;
  description?: string | null;
  specifications?: any | null;
  currentPrice?: number;
  originalPrice?: number | null;
  currency?: string;
  inStock?: boolean;
  stockQuantity?: number;
  images?: any | null;
  primaryImageUrl?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  status?: ProductStatus;
  compatibleVehicles?: any | null;
  partNumber?: string | null;
}

/**
 * Admin Product Repository
 * Handles CRUD operations for product management
 */
export class AdminProductRepository {
  /**
   * Create a new product
   */
  async create(data: CreateProductData, userId: string) {
    try {
      // Create product
      const product = await prisma.product.create({
        data: {
          sku: data.sku,
          name: data.name,
          slug: data.slug,
          brandId: data.brandId || null,
          categoryId: data.categoryId,
          description: data.description || null,
          specifications: data.specifications || null,
          currentPrice: data.currentPrice,
          originalPrice: data.originalPrice || null,
          currency: data.currency || 'TND',
          inStock: data.inStock ?? true,
          stockQuantity: data.stockQuantity ?? 0,
          images: data.images || null,
          primaryImageUrl: data.primaryImageUrl || null,
          metaTitle: data.metaTitle || null,
          metaDescription: data.metaDescription || null,
          status: data.status || 'ACTIVE',
          compatibleVehicles: data.compatibleVehicles || null,
          partNumber: data.partNumber || null,
        },
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

      // Create initial price history entry
      await prisma.priceHistory.create({
        data: {
          productId: product.id,
          oldPrice: null,
          newPrice: data.currentPrice,
          changedBy: userId,
          reason: 'Initial price',
        },
      });

      logger.info('Product created', {
        productId: product.id,
        sku: product.sku,
        userId,
      });

      return product;
    } catch (error) {
      logger.error('Failed to create product', { error, data });
      throw error;
    }
  }

  /**
   * Update existing product
   */
  async update(id: string, data: UpdateProductData, userId: string) {
    try {
      // Get current product for price change tracking
      const currentProduct = await prisma.product.findUnique({
        where: { id },
        select: { currentPrice: true },
      });

      if (!currentProduct) {
        throw new Error(`Product not found: ${id}`);
      }

      // Update product
      const product = await prisma.product.update({
        where: { id },
        data: {
          ...(data.sku && { sku: data.sku }),
          ...(data.name && { name: data.name }),
          ...(data.slug && { slug: data.slug }),
          ...(data.brandId !== undefined && { brandId: data.brandId || null }),
          ...(data.categoryId && { categoryId: data.categoryId }),
          ...(data.description !== undefined && { description: data.description || null }),
          ...(data.specifications !== undefined && {
            specifications: data.specifications || null,
          }),
          ...(data.currentPrice !== undefined && { currentPrice: data.currentPrice }),
          ...(data.originalPrice !== undefined && {
            originalPrice: data.originalPrice || null,
          }),
          ...(data.currency && { currency: data.currency }),
          ...(data.inStock !== undefined && { inStock: data.inStock }),
          ...(data.stockQuantity !== undefined && { stockQuantity: data.stockQuantity }),
          ...(data.images !== undefined && { images: data.images || null }),
          ...(data.primaryImageUrl !== undefined && {
            primaryImageUrl: data.primaryImageUrl || null,
          }),
          ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle || null }),
          ...(data.metaDescription !== undefined && {
            metaDescription: data.metaDescription || null,
          }),
          ...(data.status && { status: data.status }),
          ...(data.compatibleVehicles !== undefined && {
            compatibleVehicles: data.compatibleVehicles || null,
          }),
          ...(data.partNumber !== undefined && { partNumber: data.partNumber || null }),
        },
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

      // Track price change if price was updated
      if (data.currentPrice !== undefined && data.currentPrice !== currentProduct.currentPrice) {
        await prisma.priceHistory.create({
          data: {
            productId: id,
            oldPrice: currentProduct.currentPrice,
            newPrice: data.currentPrice,
            changedBy: userId,
            reason: 'Manual price update',
          },
        });

        logger.info('Product price changed', {
          productId: id,
          oldPrice: currentProduct.currentPrice,
          newPrice: data.currentPrice,
          userId,
        });
      }

      logger.info('Product updated', {
        productId: id,
        userId,
        changedFields: Object.keys(data),
      });

      return product;
    } catch (error) {
      logger.error('Failed to update product', { error, id, data });
      throw error;
    }
  }

  /**
   * Delete product (soft delete by setting status to DISCONTINUED)
   */
  async delete(id: string, userId: string) {
    try {
      // Soft delete: set status to DISCONTINUED
      const product = await prisma.product.update({
        where: { id },
        data: {
          status: 'DISCONTINUED',
          inStock: false,
        },
      });

      logger.info('Product deleted (soft)', {
        productId: id,
        userId,
      });

      return product;
    } catch (error) {
      logger.error('Failed to delete product', { error, id });
      throw error;
    }
  }

  /**
   * Hard delete product (permanent deletion)
   * Use with caution - only for admin cleanup
   */
  async hardDelete(id: string, userId: string) {
    try {
      // Delete in transaction to handle foreign key constraints
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Delete price history first
        await tx.priceHistory.deleteMany({
          where: { productId: id },
        });

        // Delete the product
        await tx.product.delete({
          where: { id },
        });
      });

      logger.warn('Product hard deleted (permanent)', {
        productId: id,
        userId,
      });

      return { id, deleted: true };
    } catch (error) {
      logger.error('Failed to hard delete product', { error, id });
      throw error;
    }
  }

  /**
   * Get product by ID (admin view with all fields)
   */
  async findById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        category: true,
        priceHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * List all products (admin view with filters)
   */
  async findMany(filters: {
    status?: ProductStatus;
    categoryId?: number;
    brandId?: number;
    search?: string;
    inStock?: boolean;
    skip?: number;
    take?: number;
  }) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.brandId) {
      where.brandId = filters.brandId;
    }

    if (filters.inStock !== undefined) {
      where.inStock = filters.inStock;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
        { partNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
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
        orderBy: { createdAt: 'desc' },
        skip: filters.skip || 0,
        take: filters.take || 20,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      data: products,
      total,
      page: Math.floor((filters.skip || 0) / (filters.take || 20)) + 1,
      pageSize: filters.take || 20,
      totalPages: Math.ceil(total / (filters.take || 20)),
    };
  }

  /**
   * Check if SKU exists
   */
  async skuExists(sku: string, excludeId?: string): Promise<boolean> {
    const product = await prisma.product.findUnique({
      where: { sku },
      select: { id: true },
    });

    if (!product) return false;
    if (excludeId && product.id === excludeId) return false;
    return true;
  }

  /**
   * Check if slug exists
   */
  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!product) return false;
    if (excludeId && product.id === excludeId) return false;
    return true;
  }
}
