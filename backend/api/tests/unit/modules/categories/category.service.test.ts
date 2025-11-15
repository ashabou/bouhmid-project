import { CategoryService } from '@/modules/categories/category.service';
import { CategoryRepository } from '@/modules/categories/category.repository';
import { cacheService } from '@/shared/cache/cache.service';
import { NotFoundError } from '@/shared/errors/app.error';

// Mock dependencies
jest.mock('@/modules/categories/category.repository');
jest.mock('@/shared/cache/cache.service');
jest.mock('@/shared/logger/winston.config', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('CategoryService', () => {
  let categoryService: CategoryService;
  let mockCategoryRepository: jest.Mocked<CategoryRepository>;

  const mockCategory = {
    id: 1,
    parentId: null,
    name: 'Engine Parts',
    slug: 'engine-parts',
    description: 'All engine related parts',
    imageUrl: 'https://example.com/engine.jpg',
    level: 1,
    sortOrder: 1,
    isActive: true,
    _count: { products: 150 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSubcategory = {
    id: 2,
    parentId: 1,
    name: 'Pistons',
    slug: 'pistons',
    description: 'Engine pistons',
    imageUrl: 'https://example.com/pistons.jpg',
    level: 2,
    sortOrder: 1,
    isActive: true,
    _count: { products: 25 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCategoryWithChildren = {
    ...mockCategory,
    children: [mockSubcategory],
    products: [],
  };

  const mockCategoryTree = [
    {
      ...mockCategory,
      children: [
        {
          ...mockSubcategory,
          children: [],
        },
      ],
    },
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock repository
    mockCategoryRepository = {
      findAll: jest.fn(),
      getCategoryTree: jest.fn(),
      findBySlugWithProducts: jest.fn(),
      findById: jest.fn(),
    } as any;

    // Create service instance
    categoryService = new CategoryService(mockCategoryRepository);
  });

  describe('list', () => {
    const mockCategories = [mockCategory, mockSubcategory];

    it('should return cached categories if available', async () => {
      // Arrange
      const cacheKey = 'categories:list:all:all';
      const cachedResponse = {
        data: mockCategories.map((c) => ({ ...c, productCount: c._count.products })),
      };
      (cacheService.get as jest.Mock).mockResolvedValue(cachedResponse);

      // Act
      const result = await categoryService.list();

      // Assert
      expect(cacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(cachedResponse);
      expect(mockCategoryRepository.findAll).not.toHaveBeenCalled();
    });

    it('should query database and cache results if not cached', async () => {
      // Arrange
      const cacheKey = 'categories:list:all:all';
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockCategoryRepository.findAll.mockResolvedValue(mockCategories as any);

      // Act
      const result = await categoryService.list();

      // Assert
      expect(mockCategoryRepository.findAll).toHaveBeenCalledWith(undefined, undefined);
      expect(cacheService.set).toHaveBeenCalledWith(
        cacheKey,
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              id: mockCategory.id,
              name: mockCategory.name,
              productCount: 150,
            }),
          ]),
        }),
        3600
      );
      expect((result as any).data).toHaveLength(2);
    });

    it('should filter active categories when isActive is true', async () => {
      // Arrange
      const cacheKey = 'categories:list:true:all';
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockCategoryRepository.findAll.mockResolvedValue([mockCategory] as any);

      // Act
      await categoryService.list(true);

      // Assert
      expect(mockCategoryRepository.findAll).toHaveBeenCalledWith(true, undefined);
      expect(cacheService.set).toHaveBeenCalledWith(
        cacheKey,
        expect.any(Object),
        3600
      );
    });

    it('should filter by level when specified', async () => {
      // Arrange
      const cacheKey = 'categories:list:all:1';
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockCategoryRepository.findAll.mockResolvedValue([mockCategory] as any);

      // Act
      await categoryService.list(undefined, 1);

      // Assert
      expect(mockCategoryRepository.findAll).toHaveBeenCalledWith(undefined, 1);
      expect(cacheService.set).toHaveBeenCalledWith(
        cacheKey,
        expect.any(Object),
        3600
      );
    });

    it('should filter by both isActive and level', async () => {
      // Arrange
      const cacheKey = 'categories:list:true:2';
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockCategoryRepository.findAll.mockResolvedValue([mockSubcategory] as any);

      // Act
      await categoryService.list(true, 2);

      // Assert
      expect(mockCategoryRepository.findAll).toHaveBeenCalledWith(true, 2);
      expect(cacheService.set).toHaveBeenCalledWith(
        cacheKey,
        expect.any(Object),
        3600
      );
    });

    it('should transform category data to include productCount', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockCategoryRepository.findAll.mockResolvedValue([mockCategory] as any);

      // Act
      const result = await categoryService.list();

      // Assert
      expect((result as any).data[0]).toHaveProperty('productCount', 150);
      expect((result as any).data[0]).toHaveProperty('id', mockCategory.id);
      expect((result as any).data[0]).toHaveProperty('name', mockCategory.name);
      expect((result as any).data[0]).toHaveProperty('slug', mockCategory.slug);
      expect((result as any).data[0]).toHaveProperty('level', mockCategory.level);
    });

    it('should handle empty category list', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockCategoryRepository.findAll.mockResolvedValue([]);

      // Act
      const result = await categoryService.list();

      // Assert
      expect((result as any).data).toHaveLength(0);
      expect(cacheService.set).toHaveBeenCalled();
    });
  });

  describe('getTree', () => {
    it('should return cached category tree if available', async () => {
      // Arrange
      const cacheKey = 'categories:tree';
      const cachedResponse = { data: mockCategoryTree };
      (cacheService.get as jest.Mock).mockResolvedValue(cachedResponse);

      // Act
      const result = await categoryService.getTree();

      // Assert
      expect(cacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(cachedResponse);
      expect(mockCategoryRepository.getCategoryTree).not.toHaveBeenCalled();
    });

    it('should query database and cache tree if not cached', async () => {
      // Arrange
      const cacheKey = 'categories:tree';
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockCategoryRepository.getCategoryTree.mockResolvedValue(mockCategoryTree as any);

      // Act
      const result = await categoryService.getTree();

      // Assert
      expect(mockCategoryRepository.getCategoryTree).toHaveBeenCalled();
      expect(cacheService.set).toHaveBeenCalledWith(
        cacheKey,
        { data: mockCategoryTree },
        3600
      );
      expect((result as any).data).toEqual(mockCategoryTree);
    });

    it('should return hierarchical structure', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockCategoryRepository.getCategoryTree.mockResolvedValue(mockCategoryTree as any);

      // Act
      const result = await categoryService.getTree();

      // Assert
      expect((result as any).data).toHaveLength(1);
      expect((result as any).data[0]).toHaveProperty('children');
      expect((result as any).data[0].children).toHaveLength(1);
    });

    it('should handle empty tree', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockCategoryRepository.getCategoryTree.mockResolvedValue([]);

      // Act
      const result = await categoryService.getTree();

      // Assert
      expect((result as any).data).toHaveLength(0);
    });
  });

  describe('getBySlug', () => {
    const slug = 'engine-parts';
    const cacheKey = `category:slug:${slug}`;

    it('should return cached category if available', async () => {
      // Arrange
      const cachedResponse = {
        ...mockCategoryWithChildren,
        productCount: 150,
      };
      (cacheService.get as jest.Mock).mockResolvedValue(cachedResponse);

      // Act
      const result = await categoryService.getBySlug(slug);

      // Assert
      expect(cacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(cachedResponse);
      expect(mockCategoryRepository.findBySlugWithProducts).not.toHaveBeenCalled();
    });

    it('should query database and cache result if not cached', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockCategoryRepository.findBySlugWithProducts.mockResolvedValue(
        mockCategoryWithChildren as any
      );

      // Act
      const result = await categoryService.getBySlug(slug);

      // Assert
      expect(mockCategoryRepository.findBySlugWithProducts).toHaveBeenCalledWith(slug);
      expect(cacheService.set).toHaveBeenCalledWith(
        cacheKey,
        expect.objectContaining({
          id: mockCategoryWithChildren.id,
          name: mockCategoryWithChildren.name,
          productCount: 150,
        }),
        1800
      );
      expect(result).toHaveProperty('productCount', 150);
      expect(result).toHaveProperty('_count', undefined);
    });

    it('should throw NotFoundError if category does not exist', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockCategoryRepository.findBySlugWithProducts.mockResolvedValue(null);

      // Act & Assert
      await expect(categoryService.getBySlug(slug)).rejects.toThrow(NotFoundError);
      await expect(categoryService.getBySlug(slug)).rejects.toThrow(
        `Category not found: ${slug}`
      );
    });

    it('should include children with productCount', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockCategoryRepository.findBySlugWithProducts.mockResolvedValue(
        mockCategoryWithChildren as any
      );

      // Act
      const result = await categoryService.getBySlug(slug);

      // Assert
      expect(result).toHaveProperty('children');
      expect(result.children).toHaveLength(1);
      expect(result.children[0]).toHaveProperty('productCount', 25);
      expect(result.children[0]).toHaveProperty('_count', undefined);
    });

    it('should remove _count from parent and children', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockCategoryRepository.findBySlugWithProducts.mockResolvedValue(
        mockCategoryWithChildren as any
      );

      // Act
      const result = await categoryService.getBySlug(slug);

      // Assert
      expect(result._count).toBeUndefined();
      expect(result.children[0]._count).toBeUndefined();
    });
  });

  describe('cache integration', () => {
    it('should use different cache keys for different filters', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockCategoryRepository.findAll.mockResolvedValue([]);

      await categoryService.list();
      await categoryService.list(true);
      await categoryService.list(undefined, 1);
      await categoryService.list(true, 2);

      expect(cacheService.get).toHaveBeenCalledWith('categories:list:all:all');
      expect(cacheService.get).toHaveBeenCalledWith('categories:list:true:all');
      expect(cacheService.get).toHaveBeenCalledWith('categories:list:all:1');
      expect(cacheService.get).toHaveBeenCalledWith('categories:list:true:2');
    });

    it('should cache list and tree for 1 hour', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockCategoryRepository.findAll.mockResolvedValue([mockCategory] as any);
      mockCategoryRepository.getCategoryTree.mockResolvedValue(mockCategoryTree as any);

      await categoryService.list();
      await categoryService.getTree();

      expect(cacheService.set).toHaveBeenCalledWith(
        'categories:list:all:all',
        expect.any(Object),
        3600
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        'categories:tree',
        expect.any(Object),
        3600
      );
    });

    it('should cache category detail for 30 minutes', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockCategoryRepository.findBySlugWithProducts.mockResolvedValue(
        mockCategoryWithChildren as any
      );

      await categoryService.getBySlug('engine-parts');

      expect(cacheService.set).toHaveBeenCalledWith(
        'category:slug:engine-parts',
        expect.any(Object),
        1800
      );
    });
  });
});
