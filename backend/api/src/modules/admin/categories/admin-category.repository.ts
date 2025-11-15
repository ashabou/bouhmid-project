import { prisma } from '@/shared/database/client.js';
import { logger } from '@/shared/logger/winston.config.js';

export interface CreateCategoryData {
  name: string;
  slug: string;
  description?: string;
  parentId?: number | null;
  level: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateCategoryData {
  name?: string;
  slug?: string;
  description?: string | null;
  parentId?: number | null;
  level?: number;
  sortOrder?: number;
  isActive?: boolean;
}

/**
 * Admin Category Repository
 * Handles CRUD operations for category management
 */
export class AdminCategoryRepository {
  /**
   * Create a new category
   */
  async create(data: CreateCategoryData) {
    try {
      const category = await prisma.category.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description || null,
          parentId: data.parentId || null,
          level: data.level,
          sortOrder: data.sortOrder ?? 0,
          isActive: data.isActive ?? true,
        },
        include: {
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              products: true,
              children: true,
            },
          },
        },
      });

      logger.info('Category created', {
        categoryId: category.id,
        name: category.name,
        slug: category.slug,
        level: category.level,
      });

      return category;
    } catch (error) {
      logger.error('Failed to create category', { error, data });
      throw error;
    }
  }

  /**
   * Update existing category
   */
  async update(id: number, data: UpdateCategoryData) {
    try {
      const category = await prisma.category.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.slug && { slug: data.slug }),
          ...(data.description !== undefined && { description: data.description || null }),
          ...(data.parentId !== undefined && { parentId: data.parentId || null }),
          ...(data.level !== undefined && { level: data.level }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
        include: {
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              products: true,
              children: true,
            },
          },
        },
      });

      logger.info('Category updated', {
        categoryId: id,
        changedFields: Object.keys(data),
      });

      return category;
    } catch (error) {
      logger.error('Failed to update category', { error, id, data });
      throw error;
    }
  }

  /**
   * Delete category (soft delete by setting isActive to false)
   * Only allowed if category has no associated products or children
   */
  async delete(id: number) {
    try {
      // Check for associated products
      const productCount = await prisma.product.count({
        where: { categoryId: id },
      });

      if (productCount > 0) {
        throw new Error(
          `Cannot delete category: ${productCount} product(s) are associated with this category. Please reassign or delete products first.`
        );
      }

      // Check for children categories
      const childrenCount = await prisma.category.count({
        where: { parentId: id },
      });

      if (childrenCount > 0) {
        throw new Error(
          `Cannot delete category: ${childrenCount} sub-category(ies) exist. Please delete or reassign sub-categories first.`
        );
      }

      // Soft delete: set isActive to false
      const category = await prisma.category.update({
        where: { id },
        data: {
          isActive: false,
        },
      });

      logger.info('Category deleted (soft)', {
        categoryId: id,
        name: category.name,
      });

      return category;
    } catch (error) {
      logger.error('Failed to delete category', { error, id });
      throw error;
    }
  }

  /**
   * Hard delete category (permanent deletion)
   * Only allowed if category has no associated products or children
   * Use with caution - only for admin cleanup
   */
  async hardDelete(id: number) {
    try {
      // Check for associated products
      const productCount = await prisma.product.count({
        where: { categoryId: id },
      });

      if (productCount > 0) {
        throw new Error(
          `Cannot delete category: ${productCount} product(s) are associated with this category. Please reassign or delete products first.`
        );
      }

      // Check for children categories
      const childrenCount = await prisma.category.count({
        where: { parentId: id },
      });

      if (childrenCount > 0) {
        throw new Error(
          `Cannot delete category: ${childrenCount} sub-category(ies) exist. Please delete or reassign sub-categories first.`
        );
      }

      // Hard delete
      await prisma.category.delete({
        where: { id },
      });

      logger.warn('Category hard deleted (permanent)', {
        categoryId: id,
      });

      return { id, deleted: true };
    } catch (error) {
      logger.error('Failed to hard delete category', { error, id });
      throw error;
    }
  }

  /**
   * Get category by ID (admin view with product count and children)
   */
  async findById(id: number) {
    return prisma.category.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          orderBy: {
            sortOrder: 'asc',
          },
          include: {
            _count: {
              select: {
                products: true,
              },
            },
          },
        },
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });
  }

  /**
   * List all categories (admin view with filters)
   */
  async findMany(filters: {
    isActive?: boolean;
    level?: number;
    parentId?: number | null;
    search?: string;
    skip?: number;
    take?: number;
  }) {
    const where: any = {};

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.level !== undefined) {
      where.level = filters.level;
    }

    if (filters.parentId !== undefined) {
      where.parentId = filters.parentId === null ? null : filters.parentId;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { slug: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        include: {
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              products: true,
              children: true,
            },
          },
        },
        orderBy: [
          { level: 'asc' },
          { sortOrder: 'asc' },
          { name: 'asc' },
        ],
        skip: filters.skip || 0,
        take: filters.take || 20,
      }),
      prisma.category.count({ where }),
    ]);

    return {
      data: categories,
      total,
      page: Math.floor((filters.skip || 0) / (filters.take || 20)) + 1,
      pageSize: filters.take || 20,
      totalPages: Math.ceil(total / (filters.take || 20)),
    };
  }

  /**
   * Get complete category tree (all levels)
   */
  async getCategoryTree() {
    const categories = await prisma.category.findMany({
      orderBy: [
        { level: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      include: {
        _count: {
          select: {
            products: true,
            children: true,
          },
        },
      },
    });

    // Build tree structure
    const categoryMap = new Map();
    const rootCategories: any[] = [];

    // First pass: create map of all categories
    categories.forEach((cat: any) => {
      categoryMap.set(cat.id, {
        ...cat,
        productCount: cat._count.products,
        childrenCount: cat._count.children,
        children: [],
        _count: undefined,
      });
    });

    // Second pass: build tree
    categories.forEach((cat: any) => {
      const category = categoryMap.get(cat.id);
      if (cat.parentId === null) {
        rootCategories.push(category);
      } else {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children.push(category);
        }
      }
    });

    return rootCategories;
  }

  /**
   * Reorder categories (update sortOrder)
   */
  async reorder(categoryIds: number[]) {
    try {
      // Update sortOrder for each category
      const updates = categoryIds.map((id, index) =>
        prisma.category.update({
          where: { id },
          data: { sortOrder: index },
        })
      );

      await Promise.all(updates);

      logger.info('Categories reordered', {
        count: categoryIds.length,
      });

      return { success: true, updated: categoryIds.length };
    } catch (error) {
      logger.error('Failed to reorder categories', { error, categoryIds });
      throw error;
    }
  }

  /**
   * Check if category name exists
   */
  async nameExists(name: string, excludeId?: number): Promise<boolean> {
    const category = await prisma.category.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });

    if (!category) return false;
    if (excludeId && category.id === excludeId) return false;
    return true;
  }

  /**
   * Check if slug exists
   */
  async slugExists(slug: string, excludeId?: number): Promise<boolean> {
    const category = await prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!category) return false;
    if (excludeId && category.id === excludeId) return false;
    return true;
  }

  /**
   * Validate parent category exists and get its level
   */
  async validateParent(parentId: number): Promise<{ id: number; level: number } | null> {
    return prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true, level: true },
    });
  }
}
