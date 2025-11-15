# Frontend Integration Guide

Complete guide for integrating the Shabou Auto Pièces frontend with the API backend.

## 📚 Table of Contents

- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [TypeScript Types](#typescript-types)
- [Authentication](#authentication)
- [CORS Configuration](#cors-configuration)
- [API Endpoints](#api-endpoints)
- [Testing Integration](#testing-integration)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## 🚀 Quick Start

### 1. API Base URL

Configure your frontend to use the correct API base URL:

```typescript
// Environment-specific API URLs
const API_URLS = {
  development: 'http://localhost:3000',
  staging: 'https://staging-api.shabouautopieces.tn',
  production: 'https://api.shabouautopieces.tn',
};

const API_BASE_URL = API_URLS[import.meta.env.MODE] || API_URLS.development;
```

### 2. Install Dependencies

```bash
# If using the type definitions
npm install @shabou-autopieces/api-types

# Or copy types from /openapi.json
curl http://localhost:3000/openapi.json > openapi.json
```

### 3. Basic API Client Setup

```typescript
import type { Product, ApiResponse } from '@shabou-autopieces/api-types';

const apiClient = {
  baseURL: API_BASE_URL,

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include', // Important for cookies/JWT
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }

    return response.json();
  },

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  },

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// Usage
const products = await apiClient.get<ApiResponse<Product[]>>('/api/v1/products');
```

---

## 📖 API Documentation

### Swagger UI

Interactive API documentation is available at:

- **Local**: http://localhost:3000/docs
- **Staging**: https://staging-api.shabouautopieces.tn/docs
- **Production**: https://api.shabouautopieces.tn/docs

### OpenAPI Spec

Download the OpenAPI 3.0 specification:

```bash
# JSON format
curl http://localhost:3000/openapi.json > openapi.json

# Use in code generation tools
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:3000/openapi.json \
  -g typescript-fetch \
  -o ./src/api-client
```

---

## 📝 TypeScript Types

### Using Type Definitions

Import types from the generated definitions:

```typescript
import type {
  Product,
  Brand,
  Category,
  ProductListResponse,
  CreateProductRequest,
  ApiError,
} from '@shabou-autopieces/api-types';

// Product list with pagination
const fetchProducts = async (
  cursor?: string,
  limit = 20
): Promise<ProductListResponse> => {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', limit.toString());

  return apiClient.get(`/api/v1/products?${params}`);
};

// Create product
const createProduct = async (
  data: CreateProductRequest
): Promise<Product> => {
  return apiClient.post('/api/v1/admin/products', data);
};
```

### Type Exports

All types are exported from `src/types/index.ts`:

```typescript
export type {
  // Models
  Product,
  Brand,
  Category,
  Lead,
  AdminUser,

  // Responses
  ProductListResponse,
  LoginResponse,
  ApiResponse,
  PaginationMeta,

  // Requests
  LoginRequest,
  CreateProductRequest,
  SearchQuery,

  // Errors
  ApiError,
  ValidationError,
};
```

---

## 🔐 Authentication

### Login Flow

```typescript
import type { LoginRequest, LoginResponse } from '@shabou-autopieces/api-types';

// 1. Login
const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>(
    '/api/v1/admin/auth/login',
    credentials
  );

  // Store tokens
  localStorage.setItem('accessToken', response.accessToken);
  localStorage.setItem('refreshToken', response.refreshToken);

  return response;
};

// 2. Add token to requests
const authenticatedClient = {
  ...apiClient,

  async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = localStorage.getItem('accessToken');

    return apiClient.request<T>(endpoint, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
  },
};

// 3. Handle token refresh
const refreshToken = async (): Promise<void> => {
  const refreshToken = localStorage.getItem('refreshToken');

  const response = await apiClient.post<LoginResponse>(
    '/api/v1/admin/auth/refresh',
    { refreshToken }
  );

  localStorage.setItem('accessToken', response.accessToken);
  localStorage.setItem('refreshToken', response.refreshToken);
};

// 4. Logout
const logout = async (): Promise<void> => {
  await authenticatedClient.post('/api/v1/admin/auth/logout', {});
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};
```

### Protected Routes

```typescript
// Check if user is authenticated
const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('accessToken');
};

// Get current user
const getCurrentUser = async () => {
  return authenticatedClient.get('/api/v1/admin/auth/me');
};
```

---

## 🌐 CORS Configuration

### Allowed Origins

The API allows the following origins based on environment:

**Production**:
- `https://shabouautopieces.tn`
- `https://www.shabouautopieces.tn`

**Staging**:
- `https://staging.shabouautopieces.tn`
- `https://staging-www.shabouautopieces.tn`

**Development**:
- `http://localhost:5173` (Vite default)
- `http://localhost:3000`
- `http://127.0.0.1:5173`

### Custom Origins

Set custom origins via environment variables:

```bash
# Single custom origin
FRONTEND_URL=https://custom.domain.com

# Multiple origins (comma-separated)
CORS_ALLOWED_ORIGINS=https://app1.com,https://app2.com
```

### Credentials

**Important**: Always include credentials in fetch requests:

```typescript
fetch(url, {
  credentials: 'include', // Required for JWT cookies
});
```

---

## 🔌 API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/` | API info |
| GET | `/docs` | Swagger UI |
| GET | `/openapi.json` | OpenAPI spec |

### Products

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/products` | List products (paginated) | No |
| GET | `/api/v1/products/:id` | Get product by ID | No |
| GET | `/api/v1/products/:id/related` | Get related products | No |

### Brands

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/brands` | List brands | No |
| GET | `/api/v1/brands/:id` | Get brand by ID | No |
| GET | `/api/v1/brands/:id/products` | Get brand products | No |

### Categories

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/categories` | List categories | No |
| GET | `/api/v1/categories/:id` | Get category by ID | No |
| GET | `/api/v1/categories/:id/products` | Get category products | No |

### Search

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/search` | Search products | No |
| GET | `/api/v1/search/barcode/:code` | Search by barcode | No |
| GET | `/api/v1/search/reference/:ref` | Search by reference | No |

### Admin - Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/admin/auth/login` | Login | No |
| POST | `/api/v1/admin/auth/refresh` | Refresh token | No |
| POST | `/api/v1/admin/auth/logout` | Logout | Yes |
| GET | `/api/v1/admin/auth/me` | Get current user | Yes |

### Admin - Products

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/admin/products` | Create product | Yes |
| PUT | `/api/v1/admin/products/:id` | Update product | Yes |
| DELETE | `/api/v1/admin/products/:id` | Delete product | Yes |
| POST | `/api/v1/admin/products/import` | Bulk import CSV | Yes |

---

## 🧪 Testing Integration

### 1. Test CORS

```bash
# Test from frontend origin
curl -X OPTIONS http://localhost:3000/api/v1/products \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  -v

# Should return:
# Access-Control-Allow-Origin: http://localhost:5173
# Access-Control-Allow-Credentials: true
```

### 2. Test Authentication

```bash
# Login
curl -X POST http://localhost:3000/api/v1/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@shabouautopieces.tn",
    "password": "your_password"
  }'

# Use token
curl http://localhost:3000/api/v1/admin/auth/me \
  -H "Authorization: Bearer <your_token>"
```

### 3. Test Pagination

```bash
# First page
curl "http://localhost:3000/api/v1/products?limit=10"

# Next page (use cursor from response)
curl "http://localhost:3000/api/v1/products?cursor=<cursor>&limit=10"
```

### 4. Frontend Integration Test Script

Create `test-integration.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { Product, ProductListResponse } from '@shabou-autopieces/api-types';

const API_URL = 'http://localhost:3000';

describe('API Integration Tests', () => {
  it('should fetch products', async () => {
    const response = await fetch(`${API_URL}/api/v1/products`);
    expect(response.ok).toBe(true);

    const data: ProductListResponse = await response.json();
    expect(data.data).toBeInstanceOf(Array);
    expect(data.meta).toHaveProperty('hasMore');
  });

  it('should handle CORS', async () => {
    const response = await fetch(`${API_URL}/api/v1/products`, {
      headers: { Origin: 'http://localhost:5173' },
      credentials: 'include',
    });

    expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('should authenticate admin user', async () => {
    const loginResponse = await fetch(`${API_URL}/api/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@test.com',
        password: 'test123',
      }),
    });

    expect(loginResponse.ok).toBe(true);
    const { accessToken } = await loginResponse.json();
    expect(accessToken).toBeTruthy();
  });
});
```

---

## ❌ Error Handling

### Error Types

```typescript
interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, any>;
}

interface ValidationError extends ApiError {
  statusCode: 400;
  validation: Array<{
    field: string;
    message: string;
  }>;
}
```

### Error Handling Example

```typescript
try {
  const products = await apiClient.get('/api/v1/products');
} catch (error) {
  if (error instanceof Response) {
    const apiError: ApiError = await error.json();

    switch (apiError.statusCode) {
      case 400:
        // Validation error
        console.error('Validation failed:', apiError.message);
        break;
      case 401:
        // Unauthorized - redirect to login
        window.location.href = '/login';
        break;
      case 403:
        // Forbidden
        console.error('Access denied');
        break;
      case 404:
        // Not found
        console.error('Resource not found');
        break;
      case 429:
        // Rate limit exceeded
        console.error('Too many requests, please slow down');
        break;
      case 500:
        // Server error
        console.error('Server error, please try again later');
        break;
      default:
        console.error('Unexpected error:', apiError.message);
    }
  }
}
```

---

## ✅ Best Practices

### 1. Use TypeScript Types

```typescript
// ✅ Good - Type-safe
import type { Product } from '@shabou-autopieces/api-types';
const product: Product = await apiClient.get('/api/v1/products/123');

// ❌ Bad - No type safety
const product = await apiClient.get('/api/v1/products/123');
```

### 2. Handle Pagination

```typescript
// ✅ Good - Cursor-based pagination
const loadMore = async (cursor?: string) => {
  const response = await apiClient.get<ProductListResponse>(
    `/api/v1/products?cursor=${cursor || ''}&limit=20`
  );

  return {
    products: response.data,
    nextCursor: response.meta.nextCursor,
    hasMore: response.meta.hasMore,
  };
};

// ❌ Bad - Offset pagination (not supported)
const response = await apiClient.get('/api/v1/products?page=2&limit=20');
```

### 3. Include Credentials

```typescript
// ✅ Good - Include credentials
fetch(url, { credentials: 'include' });

// ❌ Bad - No credentials
fetch(url);
```

### 4. Handle Rate Limiting

```typescript
// ✅ Good - Respect rate limit headers
const response = await fetch(url);
const remaining = response.headers.get('X-RateLimit-Remaining');
const reset = response.headers.get('X-RateLimit-Reset');

if (remaining === '0') {
  const resetTime = new Date(parseInt(reset!) * 1000);
  console.warn(`Rate limit exceeded. Resets at ${resetTime}`);
}
```

### 5. Cache Responses

```typescript
// ✅ Good - Cache immutable data
const cache = new Map<string, any>();

const fetchBrands = async (): Promise<Brand[]> => {
  if (cache.has('brands')) {
    return cache.get('brands');
  }

  const brands = await apiClient.get('/api/v1/brands');
  cache.set('brands', brands);
  return brands;
};
```

---

## 🔗 Resources

- **API Docs**: http://localhost:3000/docs
- **OpenAPI Spec**: http://localhost:3000/openapi.json
- **Health Check**: http://localhost:3000/health
- **Prometheus Metrics**: http://localhost:3000/metrics (internal)

## 📞 Support

For API-related issues:
1. Check the Swagger documentation
2. Review error messages in the response
3. Check CORS configuration
4. Verify authentication tokens
5. Contact the backend team
