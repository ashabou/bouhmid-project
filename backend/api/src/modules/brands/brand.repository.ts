import { prisma } from '@/shared/database/client.js';

export class BrandRepository {
  /**
   * Find all brands with optional filters
   */
  async findAll(isActive?: boolean) {
    const where: any = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return prisma.brand.findMany({
      where,
      orderBy: {
        name: 'asc',
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
    });
  }

  /**
   * Find brand by slug
   */
  async findBySlug(slug: string) {
    return prisma.brand.findUnique({
      where: { slug },
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
   * Find brand by ID
   */
  async findById(id: number) {
    return prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });
  }

  /**
   * Check if brand exists by slug
   */
  async existsBySlug(slug: string): Promise<boolean> {
    const count = await prisma.brand.count({ where: { slug } });
    return count > 0;
  }

  /**
   * Get brand with product samples
   */
  async findBySlugWithProducts(slug: string, limit = 8) {
    const brand = await prisma.brand.findUnique({
      where: { slug },
      include: {
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

    return brand;
  }
}
