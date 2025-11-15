import { BrandService } from '@/modules/brands/brand.service';
import { BrandRepository } from '@/modules/brands/brand.repository';
import { cacheService } from '@/shared/cache/cache.service';
import { NotFoundError } from '@/shared/errors/app.error';

// Mock dependencies
jest.mock('@/modules/brands/brand.repository');
jest.mock('@/shared/cache/cache.service');
jest.mock('@/shared/logger/winston.config', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('BrandService', () => {
  let brandService: BrandService;
  let mockBrandRepository: jest.Mocked<BrandRepository>;

  const mockBrand = {
    id: 1,
    name: 'Test Brand',
    slug: 'test-brand',
    logoUrl: 'https://example.com/logo.jpg',
    description: 'A test brand',
    countryOfOrigin: 'USA',
    isActive: true,
    _count: { products: 42 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBrandWithProducts = {
    ...mockBrand,
    products: [
      {
        id: 'prod-1',
        name: 'Product 1',
        slug: 'product-1',
        currentPrice: 99.99,
      },
      {
        id: 'prod-2',
        name: 'Product 2',
        slug: 'product-2',
        currentPrice: 149.99,
      },
    ],
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock repository
    mockBrandRepository = {
      findAll: jest.fn(),
      findBySlugWithProducts: jest.fn(),
      findById: jest.fn(),
    } as any;

    // Create service instance
    brandService = new BrandService(mockBrandRepository);
  });

  describe('list', () => {
    const mockBrands = [
      mockBrand,
      {
        ...mockBrand,
        id: 2,
        name: 'Another Brand',
        slug: 'another-brand',
        _count: { products: 15 },
      },
    ];

    it('should return cached brands if available', async () => {
      // Arrange
      const cacheKey = 'brands:list:all';
      const cachedResponse = {
        data: mockBrands.map((b) => ({ ...b, productCount: b._count.products })),
      };
      (cacheService.get as jest.Mock).mockResolvedValue(cachedResponse);

      // Act
      const result = await brandService.list();

      // Assert
      expect(cacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(cachedResponse);
      expect(mockBrandRepository.findAll).not.toHaveBeenCalled();
    });

    it('should query database and cache results if not cached', async () => {
      // Arrange
      const cacheKey = 'brands:list:all';
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockBrandRepository.findAll.mockResolvedValue(mockBrands as any);

      // Act
      const result = await brandService.list();

      // Assert
      expect(mockBrandRepository.findAll).toHaveBeenCalledWith(undefined);
      expect(cacheService.set).toHaveBeenCalledWith(
        cacheKey,
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              id: mockBrand.id,
              name: mockBrand.name,
              productCount: 42,
            }),
          ]),
        }),
        3600
      );
      expect((result as any).data).toHaveLength(2);
      expect((result as any).data[0]).toHaveProperty('productCount', 42);
    });

    it('should filter active brands when isActive is true', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockBrandRepository.findAll.mockResolvedValue([mockBrand] as any);

      // Act
      await brandService.list(true);

      // Assert
      expect(mockBrandRepository.findAll).toHaveBeenCalledWith(true);
      expect(cacheService.set).toHaveBeenCalledWith(
        'brands:list:true',
        expect.any(Object),
        3600
      );
    });

    it('should handle empty brand list', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockBrandRepository.findAll.mockResolvedValue([]);

      // Act
      const result = await brandService.list();

      // Assert
      expect((result as any).data).toHaveLength(0);
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should transform brand data to include productCount', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockBrandRepository.findAll.mockResolvedValue([mockBrand] as any);

      // Act
      const result = await brandService.list();

      // Assert
      expect((result as any).data[0]).toHaveProperty('productCount', 42);
      expect((result as any).data[0]).toHaveProperty('id', mockBrand.id);
      expect((result as any).data[0]).toHaveProperty('name', mockBrand.name);
      expect((result as any).data[0]).toHaveProperty('slug', mockBrand.slug);
    });
  });

  describe('getBySlug', () => {
    const slug = 'test-brand';
    const cacheKey = `brand:slug:${slug}`;

    it('should return cached brand if available', async () => {
      // Arrange
      const cachedResponse = {
        ...mockBrandWithProducts,
        productCount: 42,
      };
      (cacheService.get as jest.Mock).mockResolvedValue(cachedResponse);

      // Act
      const result = await brandService.getBySlug(slug);

      // Assert
      expect(cacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(cachedResponse);
      expect(mockBrandRepository.findBySlugWithProducts).not.toHaveBeenCalled();
    });

    it('should query database and cache result if not cached', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockBrandRepository.findBySlugWithProducts.mockResolvedValue(
        mockBrandWithProducts as any
      );

      // Act
      const result = await brandService.getBySlug(slug);

      // Assert
      expect(mockBrandRepository.findBySlugWithProducts).toHaveBeenCalledWith(slug);
      expect(cacheService.set).toHaveBeenCalledWith(
        cacheKey,
        expect.objectContaining({
          id: mockBrandWithProducts.id,
          name: mockBrandWithProducts.name,
          productCount: 42,
        }),
        1800
      );
      expect(result).toHaveProperty('productCount', 42);
      expect(result).toHaveProperty('_count', undefined);
    });

    it('should throw NotFoundError if brand does not exist', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockBrandRepository.findBySlugWithProducts.mockResolvedValue(null);

      // Act & Assert
      await expect(brandService.getBySlug(slug)).rejects.toThrow(NotFoundError);
      await expect(brandService.getBySlug(slug)).rejects.toThrow(
        `Brand not found: ${slug}`
      );
    });

    it('should include products in response', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockBrandRepository.findBySlugWithProducts.mockResolvedValue(
        mockBrandWithProducts as any
      );

      // Act
      const result = await brandService.getBySlug(slug);

      // Assert
      expect(result).toHaveProperty('products');
      expect(result.products).toHaveLength(2);
    });

    it('should remove _count from response', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockBrandRepository.findBySlugWithProducts.mockResolvedValue(
        mockBrandWithProducts as any
      );

      // Act
      const result = await brandService.getBySlug(slug);

      // Assert
      expect(result._count).toBeUndefined();
    });
  });

  describe('cache integration', () => {
    it('should use different cache keys for active vs all brands', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockBrandRepository.findAll.mockResolvedValue([]);

      await brandService.list();
      await brandService.list(true);
      await brandService.list(false);

      expect(cacheService.get).toHaveBeenCalledWith('brands:list:all');
      expect(cacheService.get).toHaveBeenCalledWith('brands:list:true');
      expect(cacheService.get).toHaveBeenCalledWith('brands:list:false');
    });

    it('should cache list for 1 hour', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockBrandRepository.findAll.mockResolvedValue([mockBrand] as any);

      await brandService.list();

      expect(cacheService.set).toHaveBeenCalledWith(
        'brands:list:all',
        expect.any(Object),
        3600
      );
    });

    it('should cache brand detail for 30 minutes', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockBrandRepository.findBySlugWithProducts.mockResolvedValue(
        mockBrandWithProducts as any
      );

      await brandService.getBySlug('test-brand');

      expect(cacheService.set).toHaveBeenCalledWith(
        'brand:slug:test-brand',
        expect.any(Object),
        1800
      );
    });
  });
});
