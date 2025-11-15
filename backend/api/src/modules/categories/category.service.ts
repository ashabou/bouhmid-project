import { CategoryRepository } from './category.repository.js';
import { cacheService } from '@/shared/cache/cache.service.js';
import { NotFoundError } from '@/shared/errors/app.error.js';
import { logger } from '@/shared/logger/winston.config.js';

export class CategoryService {
  constructor(private categoryRepository: CategoryRepository) {}

  /**
   * List all categories (flat list)
   */
  async list(isActive?: boolean, level?: number) {
    const cacheKey = `categories:list:${isActive ?? 'all'}:${level ?? 'all'}`;

    // Check cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached category list', { cacheKey });
      return cached;
    }

    // Query database
    const categories = await this.categoryRepository.findAll(isActive, level);

    // Transform response
    const response = {
      data: categories.map((cat: any) => ({
        id: cat.id,
        parentId: cat.parentId,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        imageUrl: cat.imageUrl,
        level: cat.level,
        sortOrder: cat.sortOrder,
        isActive: cat.isActive,
        productCount: cat._count.products,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      })),
    };

    // Cache for 1 hour (categories change infrequently)
    await cacheService.set(cacheKey, response, 3600);

    logger.info('Category list queried', { count: categories.length });

    return response;
  }

  /**
   * Get category tree (hierarchical structure)
   */
  async getTree() {
    const cacheKey = 'categories:tree';

    // Check cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached category tree', { cacheKey });
      return cached;
    }

    // Query database
    const tree = await this.categoryRepository.getCategoryTree();

    const response = {
      data: tree,
    };

    // Cache for 1 hour
    await cacheService.set(cacheKey, response, 3600);

    logger.info('Category tree queried', { rootCategories: tree.length });

    return response;
  }

  /**
   * Get category by slug with subcategories and products
   */
  async getBySlug(slug: string) {
    const cacheKey = `category:slug:${slug}`;

    // Check cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logger.debug('Returning cached category', { slug });
      return cached;
    }

    // Query database
    const category = await this.categoryRepository.findBySlugWithProducts(slug);
    if (!category) {
      throw new NotFoundError(`Category not found: ${slug}`);
    }

    // Transform response
    const response = {
      ...category,
      productCount: category._count.products,
      children: category.children.map((child: any) => ({
        ...child,
        productCount: child._count.products,
        _count: undefined,
      })),
      _count: undefined,
    };

    // Cache for 30 minutes
    await cacheService.set(cacheKey, response, 1800);

    logger.info('Category viewed', { slug, categoryId: category.id });

    return response;
  }
}
