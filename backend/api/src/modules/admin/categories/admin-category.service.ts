import {
  AdminCategoryRepository,
  CreateCategoryData,
  UpdateCategoryData,
} from './admin-category.repository.js';
import { cacheService } from '@/shared/cache/cache.service.js';
import { NotFoundError, ValidationError } from '@/shared/errors/app.error.js';
import { logger } from '@/shared/logger/winston.config.js';

/**
 * Admin Category Service
 * Business logic for category management with cache invalidation
 */
export class AdminCategoryService {
  constructor(private categoryRepository: AdminCategoryRepository) {}

  /**
   * Create a new category
   */
  async create(data: CreateCategoryData) {
    // Validate name uniqueness
    const nameExists = await this.categoryRepository.nameExists(data.name);
    if (nameExists) {
      throw new ValidationError(`Category with name "${data.name}" already exists`);
    }

    // Validate slug uniqueness
    const slugExists = await this.categoryRepository.slugExists(data.slug);
    if (slugExists) {
      throw new ValidationError(`Category with slug "${data.slug}" already exists`);
    }

    // Validate parent category if provided
    if (data.parentId) {
      const parent = await this.categoryRepository.validateParent(data.parentId);
      if (!parent) {
        throw new NotFoundError(`Parent category with ID ${data.parentId} not found`);
      }

      // Set level based on parent
      data.level = parent.level + 1;

      // Validate max depth (3 levels: 0, 1, 2)
      if (data.level > 2) {
        throw new ValidationError('Maximum category depth (3 levels) exceeded');
      }
    } else {
      // Root category
      data.level = 0;
    }

    // Create category
    const category = await this.categoryRepository.create(data);

    // Invalidate all category caches
    await this.invalidateCategoryCaches();

    logger.info('Category created via admin', {
      categoryId: category.id,
      name: category.name,
    });

    return category;
  }

  /**
   * Update existing category
   */
  async update(id: number, data: UpdateCategoryData) {
    // Check if category exists
    const existingCategory = await this.categoryRepository.findById(id);
    if (!existingCategory) {
      throw new NotFoundError(`Category with ID ${id} not found`);
    }

    // Validate name uniqueness if changing
    if (data.name && data.name !== existingCategory.name) {
      const nameExists = await this.categoryRepository.nameExists(data.name, id);
      if (nameExists) {
        throw new ValidationError(`Category with name "${data.name}" already exists`);
      }
    }

    // Validate slug uniqueness if changing
    if (data.slug && data.slug !== existingCategory.slug) {
      const slugExists = await this.categoryRepository.slugExists(data.slug, id);
      if (slugExists) {
        throw new ValidationError(`Category with slug "${data.slug}" already exists`);
      }
    }

    // Validate parent change
    if (data.parentId !== undefined && data.parentId !== existingCategory.parentId) {
      // Cannot set self as parent
      if (data.parentId === id) {
        throw new ValidationError('Category cannot be its own parent');
      }

      // Check if new parent exists
      if (data.parentId !== null) {
        const parent = await this.categoryRepository.validateParent(data.parentId);
        if (!parent) {
          throw new NotFoundError(`Parent category with ID ${data.parentId} not found`);
        }

        // Update level based on new parent
        data.level = parent.level + 1;

        // Validate max depth
        if (data.level > 2) {
          throw new ValidationError('Maximum category depth (3 levels) exceeded');
        }

        // Cannot move parent into its own child
        if (existingCategory.children && existingCategory.children.length > 0) {
          const childIds = this.getChildrenIdsRecursive(existingCategory.children);
          if (childIds.includes(data.parentId)) {
            throw new ValidationError('Cannot move category into its own descendant');
          }
        }
      } else {
        // Moving to root level
        data.level = 0;
      }
    }

    // Update category
    const category = await this.categoryRepository.update(id, data);

    // Invalidate all category caches
    await this.invalidateCategoryCaches();

    logger.info('Category updated via admin', {
      categoryId: id,
      changedFields: Object.keys(data),
    });

    return category;
  }

  /**
   * Delete category (soft delete)
   */
  async delete(id: number) {
    // Check if category exists
    const existingCategory = await this.categoryRepository.findById(id);
    if (!existingCategory) {
      throw new NotFoundError(`Category with ID ${id} not found`);
    }

    // Delete (will throw error if products or children exist)
    const category = await this.categoryRepository.delete(id);

    // Invalidate all category caches
    await this.invalidateCategoryCaches();

    logger.info('Category deleted (soft) via admin', {
      categoryId: id,
      name: category.name,
    });

    return { success: true, message: 'Category deleted successfully' };
  }

  /**
   * Hard delete category (permanent)
   */
  async hardDelete(id: number) {
    // Check if category exists
    const existingCategory = await this.categoryRepository.findById(id);
    if (!existingCategory) {
      throw new NotFoundError(`Category with ID ${id} not found`);
    }

    // Hard delete (will throw error if products or children exist)
    await this.categoryRepository.hardDelete(id);

    // Invalidate all category caches
    await this.invalidateCategoryCaches();

    logger.warn('Category hard deleted (permanent) via admin', {
      categoryId: id,
    });

    return { success: true, message: 'Category permanently deleted' };
  }

  /**
   * Get category by ID
   */
  async getById(id: number) {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundError(`Category with ID ${id} not found`);
    }
    return category;
  }

  /**
   * List categories with filters
   */
  async list(filters: {
    isActive?: boolean;
    level?: number;
    parentId?: number | null;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const skip = (page - 1) * pageSize;

    return this.categoryRepository.findMany({
      isActive: filters.isActive,
      level: filters.level,
      parentId: filters.parentId,
      search: filters.search,
      skip,
      take: pageSize,
    });
  }

  /**
   * Get complete category tree
   */
  async getTree() {
    return this.categoryRepository.getCategoryTree();
  }

  /**
   * Reorder categories
   */
  async reorder(categoryIds: number[]) {
    // Validate all categories exist
    const categories = await Promise.all(
      categoryIds.map((id) => this.categoryRepository.findById(id))
    );

    const notFound = categoryIds.filter(
      (_id, index) => categories[index] === null
    );

    if (notFound.length > 0) {
      throw new NotFoundError(
        `Categories not found: ${notFound.join(', ')}`
      );
    }

    // Reorder
    const result = await this.categoryRepository.reorder(categoryIds);

    // Invalidate all category caches
    await this.invalidateCategoryCaches();

    logger.info('Categories reordered via admin', {
      count: categoryIds.length,
    });

    return result;
  }

  /**
   * Invalidate all category-related caches
   */
  private async invalidateCategoryCaches() {
    try {
      // Delete all keys matching category patterns
      await cacheService.invalidate('category:*');
      await cacheService.invalidate('categories:*');

      logger.debug('Category caches invalidated');
    } catch (error) {
      logger.error('Failed to invalidate category caches', { error });
      // Don't throw - cache invalidation failure should not block operations
    }
  }

  /**
   * Get all children IDs recursively
   */
  private getChildrenIdsRecursive(children: any[]): number[] {
    const ids: number[] = [];

    for (const child of children) {
      ids.push(child.id);
      if (child.children && child.children.length > 0) {
        ids.push(...this.getChildrenIdsRecursive(child.children));
      }
    }

    return ids;
  }
}
