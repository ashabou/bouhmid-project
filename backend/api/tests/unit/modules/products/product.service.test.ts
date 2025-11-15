import { ProductService } from '@/modules/products/product.service';
import { ProductRepository } from '@/modules/products/product.repository';
import { cacheService } from '@/shared/cache/cache.service';
import { NotFoundError } from '@/shared/errors/app.error';
import { formatPaginatedResponse } from '@/shared/utils/pagination';

// Mock dependencies
jest.mock('@/modules/products/product.repository');
jest.mock('@/shared/cache/cache.service');
jest.mock('@/shared/utils/pagination');
jest.mock('@/shared/logger/winston.config', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('ProductService', () => {
  let productService: ProductService;
  let mockProductRepository: jest.Mocked<ProductRepository>;

  const mockProduct = {
    id: 'prod-123',
    name: 'Test Product',
    slug: 'test-product',
    currentPrice: 99.99,
    categoryId: 1,
    brandId: 1,
    status: 'ACTIVE',
    primaryImageUrl: 'https://example.com/image.jpg',
    viewCount: 10,
    brand: {
      id: 1,
      name: 'Test Brand',
      slug: 'test-brand',
      logoUrl: 'https://example.com/logo.jpg',
    },
    category: {
      id: 1,
      name: 'Test Category',
      slug: 'test-category',
    },
    priceHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRelatedProducts = [
    {
      id: 'prod-456',
      name: 'Related Product',
      slug: 'related-product',
      currentPrice: 79.99,
      primaryImageUrl: 'https://example.com/related.jpg',
      brand: { name: 'Test Brand', slug: 'test-brand' },
    },
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock repository
    mockProductRepository = {
      findMany: jest.fn(),
      findBySlug: jest.fn(),
      findById: jest.fn(),
      incrementViewCount: jest.fn(),
      getRelatedProducts: jest.fn(),
    } as any;

    // Create service instance
    productService = new ProductService(mockProductRepository);
  });

  describe('list', () => {
    const mockFilters = { categoryId: 1, status: 'ACTIVE' };
    const mockSort = { sortBy: 'name', sortOrder: 'asc' as const };
    const mockPagination = { limit: 10 };
    const mockProducts = [mockProduct];
    const mockResponse = {
      data: mockProducts,
      pagination: { hasMore: false, nextCursor: null },
    };

    it('should return cached products if available', async () => {
      // Arrange
      const cacheKey = 'products:list:test-key';
      (cacheService.generateKey as jest.Mock).mockReturnValue(cacheKey);
      (cacheService.get as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      const result = await productService.list(mockFilters, mockSort, mockPagination);

      // Assert
      expect(cacheService.generateKey).toHaveBeenCalledWith('products:list', {
        filters: mockFilters,
        sort: mockSort,
        pagination: mockPagination,
      });
      expect(cacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(mockResponse);
      expect(mockProductRepository.findMany).not.toHaveBeenCalled();
    });

    it('should query database and cache results if not cached', async () => {
      // Arrange
      const cacheKey = 'products:list:test-key';
      (cacheService.generateKey as jest.Mock).mockReturnValue(cacheKey);
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockProductRepository.findMany.mockResolvedValue(mockProducts as any);
      (formatPaginatedResponse as jest.Mock).mockReturnValue(mockResponse);

      // Act
      const result = await productService.list(mockFilters, mockSort, mockPagination);

      // Assert
      expect(mockProductRepository.findMany).toHaveBeenCalledWith(
        mockFilters,
        mockSort,
        mockPagination
      );
      expect(formatPaginatedResponse).toHaveBeenCalledWith(mockProducts, mockPagination.limit);
      expect(cacheService.set).toHaveBeenCalledWith(cacheKey, mockResponse, 300);
      expect(result).toEqual(mockResponse);
    });

    it('should handle empty results', async () => {
      // Arrange
      const cacheKey = 'products:list:test-key';
      const emptyResponse = {
        data: [],
        pagination: { hasMore: false, nextCursor: null },
      };
      (cacheService.generateKey as jest.Mock).mockReturnValue(cacheKey);
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockProductRepository.findMany.mockResolvedValue([]);
      (formatPaginatedResponse as jest.Mock).mockReturnValue(emptyResponse);

      // Act
      const result = await productService.list(mockFilters, mockSort, mockPagination);

      // Assert
      expect(result).toEqual(emptyResponse);
      expect((result as any).data).toHaveLength(0);
    });
  });

  describe('getBySlug', () => {
    const slug = 'test-product';
    const cacheKey = `product:slug:${slug}`;

    it('should return cached product if available', async () => {
      // Arrange
      const cachedResponse = {
        ...mockProduct,
        relatedProducts: mockRelatedProducts,
      };
      (cacheService.get as jest.Mock).mockResolvedValue(cachedResponse);

      // Act
      const result = await productService.getBySlug(slug);

      // Assert
      expect(cacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(cachedResponse);
      expect(mockProductRepository.findBySlug).not.toHaveBeenCalled();
    });

    it('should query database and cache result if not cached', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockProductRepository.findBySlug.mockResolvedValue(mockProduct as any);
      mockProductRepository.getRelatedProducts.mockResolvedValue(mockRelatedProducts as any);
      mockProductRepository.incrementViewCount.mockResolvedValue(mockProduct as any);

      const expectedResponse = {
        ...mockProduct,
        relatedProducts: mockRelatedProducts,
      };

      // Act
      const result = await productService.getBySlug(slug);

      // Assert
      expect(mockProductRepository.findBySlug).toHaveBeenCalledWith(slug);
      expect(mockProductRepository.getRelatedProducts).toHaveBeenCalledWith(
        mockProduct.id,
        mockProduct.categoryId
      );
      expect(cacheService.set).toHaveBeenCalledWith(cacheKey, expectedResponse, 600);
      expect(result).toEqual(expectedResponse);
    });

    it('should increment view count asynchronously', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockProductRepository.findBySlug.mockResolvedValue(mockProduct as any);
      mockProductRepository.getRelatedProducts.mockResolvedValue(mockRelatedProducts as any);
      mockProductRepository.incrementViewCount.mockResolvedValue(mockProduct as any);

      // Act
      await productService.getBySlug(slug);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      expect(mockProductRepository.incrementViewCount).toHaveBeenCalledWith(mockProduct.id);
    });

    it('should throw NotFoundError if product does not exist', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockProductRepository.findBySlug.mockResolvedValue(null);

      // Act & Assert
      await expect(productService.getBySlug(slug)).rejects.toThrow(NotFoundError);
      await expect(productService.getBySlug(slug)).rejects.toThrow(
        `Product not found: ${slug}`
      );
    });

    it('should handle view count increment errors gracefully', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockProductRepository.findBySlug.mockResolvedValue(mockProduct as any);
      mockProductRepository.getRelatedProducts.mockResolvedValue(mockRelatedProducts as any);
      mockProductRepository.incrementViewCount.mockRejectedValue(
        new Error('Database error')
      );

      // Act
      const result = await productService.getBySlug(slug);

      // Assert - should still return product even if view increment fails
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', mockProduct.id);
    });
  });

  describe('getById', () => {
    const productId = 'prod-123';
    const cacheKey = `product:id:${productId}`;

    it('should return cached product if available', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(mockProduct);

      // Act
      const result = await productService.getById(productId);

      // Assert
      expect(cacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(mockProduct);
      expect(mockProductRepository.findById).not.toHaveBeenCalled();
    });

    it('should query database and cache result if not cached', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockProductRepository.findById.mockResolvedValue(mockProduct as any);

      // Act
      const result = await productService.getById(productId);

      // Assert
      expect(mockProductRepository.findById).toHaveBeenCalledWith(productId);
      expect(cacheService.set).toHaveBeenCalledWith(cacheKey, mockProduct, 600);
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundError if product does not exist', async () => {
      // Arrange
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockProductRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(productService.getById(productId)).rejects.toThrow(NotFoundError);
      await expect(productService.getById(productId)).rejects.toThrow(
        `Product not found: ${productId}`
      );
    });
  });

  describe('cache integration', () => {
    it('should use different cache keys for different queries', async () => {
      const filters1 = { categoryId: 1 };
      const filters2 = { categoryId: 2 };
      const sort = { sortBy: 'name', sortOrder: 'asc' as const };
      const pagination = { limit: 10 };

      (cacheService.generateKey as jest.Mock).mockReturnValueOnce('key1');
      (cacheService.generateKey as jest.Mock).mockReturnValueOnce('key2');
      (cacheService.get as jest.Mock).mockResolvedValue(null);
      mockProductRepository.findMany.mockResolvedValue([]);
      (formatPaginatedResponse as jest.Mock).mockReturnValue({
        data: [],
        pagination: { hasMore: false, nextCursor: null },
      });

      await productService.list(filters1, sort, pagination);
      await productService.list(filters2, sort, pagination);

      expect(cacheService.generateKey).toHaveBeenCalledTimes(2);
      expect(cacheService.generateKey).toHaveBeenNthCalledWith(1, 'products:list', {
        filters: filters1,
        sort,
        pagination,
      });
      expect(cacheService.generateKey).toHaveBeenNthCalledWith(2, 'products:list', {
        filters: filters2,
        sort,
        pagination,
      });
    });
  });
});
