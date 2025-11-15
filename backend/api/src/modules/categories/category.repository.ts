import { prisma } from '@/shared/database/client.js';

export class CategoryRepository {
  /**
   * Find all categories with optional filters
   */
  async findAll(isActive?: boolean, level?: number) {
    const where: any = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (level !== undefined) {
      where.level = level;
    }

    return prisma.category.findMany({
      where,
      orderBy: [
        { level: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      include: {
        _count: {
          select: {
            products: {
              where: {
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find category by slug
   */
  async findBySlug(slug: string) {
    return prisma.category.findUnique({
      where: { slug },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          where: {
            isActive: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
          include: {
            _count: {
              select: {
                products: {
                  where: {
                    status: 'ACTIVE',
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            products: {
              where: {
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find category by ID
   */
  async findById(id: number) {
    return prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  /**
   * Get category tree (hierarchical structure)
   */
  async getCategoryTree() {
    // Get all active categories
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { level: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      include: {
        _count: {
          select: {
            products: {
              where: {
                status: 'ACTIVE',
              },
            },
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
   * Get category with featured products
   */
  async findBySlugWithProducts(slug: string, limit = 12) {
    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        children: {
          where: {
            isActive: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
          include: {
            _count: {
              select: {
                products: {
                  where: {
                    status: 'ACTIVE',
                  },
                },
              },
            },
          },
        },
        products: {
          where: {
            status: 'ACTIVE',
          },
          take: limit,
          orderBy: {
            viewCount: 'desc',
          },
          select: {
            id: true,
            name: true,
            slug: true,
            currentPrice: true,
            primaryImageUrl: true,
            inStock: true,
            brand: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        _count: {
          select: {
            products: {
              where: {
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });

    return category;
  }

  /**
   * Check if category exists by slug
   */
  async existsBySlug(slug: string): Promise<boolean> {
    const count = await prisma.category.count({ where: { slug } });
    return count > 0;
  }
}
