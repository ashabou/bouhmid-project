# Technical Architecture

**Version**: 1.0
**Last Updated**: 2025-11-14

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Architecture Pattern](#architecture-pattern)
3. [Folder Structure](#folder-structure)
4. [Authentication & Authorization](#authentication--authorization)
5. [Caching Strategy](#caching-strategy)
6. [Performance Optimization](#performance-optimization)

---

## Technology Stack

### Core API Layer

| Component | Technology | Version | Justification |
|-----------|------------|---------|---------------|
| **Runtime** | Node.js | 20 LTS | Long-term support, mature ecosystem |
| **Language** | TypeScript | 5.3+ | Type safety, better DX, catches bugs early |
| **Framework** | Fastify | 4.x | **3x faster** than Express, built-in validation, native async/await |
| **ORM** | Prisma | Latest | Type-safe queries, excellent migrations, great DX |
| **Validation** | Zod | Latest | Runtime type safety, integrates with TypeScript |
| **Testing** | Jest + Supertest | Latest | Industry standard, great TypeScript support |

#### Why Fastify over Express?

```typescript
// Performance Comparison (req/sec)
Express:  15,000 req/sec
Fastify:  45,000 req/sec  ← 3x faster

// Built-in Features
Fastify includes:
- Schema-based validation (JSON Schema)
- Serialization optimization
- Logging (pino - fastest Node.js logger)
- TypeScript support out of the box
```

### Agent Services Layer

| Component | Technology | Version | Justification |
|-----------|------------|---------|---------------|
| **Language** | Python | 3.11+ | Best ML/scraping ecosystem |
| **Framework** | FastAPI | 0.104+ | Fast, async, automatic OpenAPI docs |
| **ML Core** | scikit-learn | Latest | Production-ready, well-documented |
| **Time Series** | statsmodels | Latest | SARIMA implementation |
| **Forecasting** | Prophet | Latest | Facebook's proven forecasting library |
| **Web Scraping** | Playwright | Latest | Handles modern JavaScript sites |
| **HTML Parsing** | BeautifulSoup4 | Latest | Simple, reliable parsing |
| **Task Queue** | Celery | 5.3+ | Battle-tested task scheduling |
| **HTTP Client** | httpx | Latest | Async HTTP for Python |

#### Why Python for Agents?

- **ML Libraries**: scikit-learn, Prophet, pandas - no equivalent in Node.js
- **Scraping**: Playwright, BeautifulSoup mature and reliable
- **Celery**: Best-in-class distributed task queue
- **Ecosystem**: Auto parts scraping = complex parsing, Python excels here

### Infrastructure Layer

| Component | Technology | Version | Justification |
|-----------|------------|---------|---------------|
| **Database** | PostgreSQL | 15+ | ACID compliant, full-featured, handles 1M+ products |
| **Cache** | Redis | 7+ | Multi-purpose: cache + queue + pub/sub |
| **Search** | PostgreSQL FTS | 15+ | Phase 1: Built-in, Phase 2: Meilisearch when >50k products |
| **Reverse Proxy** | Caddy | 2+ | **Auto-HTTPS**, simpler config than Nginx |
| **Containers** | Docker | Latest | Industry standard |
| **Orchestration** | Docker Compose | V2 | Simple, sufficient for MVP |
| **CI/CD** | GitHub Actions | - | Free, integrated with repo |
| **Monitoring** | Prometheus | Latest | Industry standard metrics |
| **Dashboards** | Grafana | Latest | Beautiful visualizations |
| **Logging** | Loki | Latest | Log aggregation, integrates with Grafana |
| **Log Library (Node)** | Winston | Latest | Flexible, supports multiple transports |
| **Metrics (Node)** | prom-client | Latest | Prometheus exporter for Node.js |

---

## Architecture Pattern

### Decision: Hybrid Modular Monolith

```
┌──────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE LAYERS                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              REVERSE PROXY (Caddy)                     │  │
│  │  • Auto-HTTPS via Let's Encrypt                        │  │
│  │  • Rate limiting                                       │  │
│  │  • Security headers                                    │  │
│  └───────────────────┬────────────────────────────────────┘  │
│                      │                                       │
│       ┌──────────────┴──────────────┐                        │
│       │                             │                        │
│  ┌────▼──────────────┐    ┌─────────▼────────────┐          │
│  │  MAIN API SERVICE │    │  AGENT SERVICES      │          │
│  │  (Node.js Monolith)│    │  (Python Microservices)│        │
│  │                   │◄───┤                      │          │
│  │ Port: 3000        │ REST│ Ports: 8001, 8002  │          │
│  └────┬──────────────┘    └─────────┬────────────┘          │
│       │                             │                        │
│       └──────────────┬──────────────┘                        │
│                      │                                       │
│              ┌───────▼────────┐                              │
│              │  POSTGRESQL 15 │                              │
│              │  (Shared DB)   │                              │
│              └───────┬────────┘                              │
│                      │                                       │
│              ┌───────▼────────┐                              │
│              │    REDIS 7     │                              │
│              │ (Cache + Queue)│                              │
│              └────────────────┘                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Why This Pattern?

#### ✅ Monolith for Main API

**Advantages:**
- **Single Deployment**: One Docker image, one CI/CD pipeline
- **Shared Types**: TypeScript interfaces shared across modules
- **Atomic Transactions**: Database transactions across multiple tables
- **Simple Debugging**: All logs in one place, no distributed tracing needed
- **Lower Latency**: No network calls between "services"
- **Lower Cost**: One container vs multiple containers

**Disadvantages (Mitigated):**
- ❌ "Will become spaghetti" → **Mitigation**: Strict module boundaries, see [Folder Structure](#folder-structure)
- ❌ "Can't scale independently" → **Mitigation**: Horizontal scaling (multiple API instances behind load balancer)
- ❌ "Single point of failure" → **Mitigation**: Multiple replicas + health checks

#### ✅ Separate Agent Services (Python Microservices)

**Advantages:**
- **Language Optimization**: Python's ML/scraping ecosystem unmatched
- **Isolation**: Agent crashes don't affect main API
- **CPU-Intensive Work**: Forecasting doesn't block API requests
- **Independent Scaling**: Can add more scraper instances without scaling API
- **Different Release Cycles**: Can update forecast models without API deployment

**Disadvantages (Mitigated):**
- ❌ "Network latency" → **Mitigation**: Async communication, agents write to DB, API reads
- ❌ "More complex deployment" → **Mitigation**: Docker Compose handles orchestration

#### ✅ Shared PostgreSQL

**Advantages:**
- **ACID Guarantees**: No eventual consistency issues
- **Complex Joins**: Can join products + forecasts + leads in single query
- **Single Backup**: One database to backup/restore
- **Referential Integrity**: Foreign keys enforce data consistency

**Disadvantages (Mitigated):**
- ❌ "Single point of failure" → **Mitigation**: Daily backups, monitoring, future read replica
- ❌ "Bottleneck" → **Mitigation**: Connection pooling, caching, read replica if needed

---

## Folder Structure

### Main API (Node.js/TypeScript)

```
api/
├── src/
│   ├── modules/                    # Domain modules (not MVC layers)
│   │   ├── products/
│   │   │   ├── product.controller.ts   # Route handlers
│   │   │   ├── product.service.ts      # Business logic
│   │   │   ├── product.repository.ts   # Data access
│   │   │   ├── product.schema.ts       # Zod validation schemas
│   │   │   ├── product.types.ts        # TypeScript interfaces
│   │   │   └── product.routes.ts       # Route definitions
│   │   ├── brands/
│   │   │   └── [same structure]
│   │   ├── categories/
│   │   ├── search/
│   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── leads/
│   │   │   └── forecasts/
│   │   └── health/
│   │
│   ├── shared/                     # Cross-cutting concerns
│   │   ├── database/
│   │   │   ├── client.ts           # Prisma client singleton
│   │   │   ├── migrations/
│   │   │   └── seeds/
│   │   ├── cache/
│   │   │   ├── redis.client.ts
│   │   │   └── cache.service.ts
│   │   ├── auth/
│   │   │   ├── jwt.service.ts
│   │   │   ├── password.service.ts
│   │   │   └── auth.middleware.ts
│   │   ├── validation/
│   │   │   └── schemas.ts
│   │   ├── errors/
│   │   │   ├── app.error.ts
│   │   │   └── error.handler.ts
│   │   ├── logger/
│   │   │   └── winston.config.ts
│   │   └── utils/
│   │       ├── pagination.ts
│   │       ├── filtering.ts
│   │       └── sorting.ts
│   │
│   ├── config/
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   └── cors.config.ts
│   │
│   ├── app.ts                      # Fastify app setup
│   └── server.ts                   # Entry point
│
├── tests/
│   ├── unit/                       # Unit tests (services, utils)
│   ├── integration/                # Integration tests (API routes)
│   └── e2e/                        # End-to-end tests
│
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── migrations/
│
├── .env.example
├── .env.development
├── .env.production
├── tsconfig.json
├── package.json
├── jest.config.js
├── Dockerfile
└── docker-compose.yml
```

#### Module Structure Pattern

```typescript
// product.routes.ts
export const productRoutes = async (fastify: FastifyInstance) => {
  const productService = new ProductService(new ProductRepository());
  const productController = new ProductController(productService);

  fastify.get('/products', productController.list);
  fastify.get('/products/:slug', productController.getBySlug);
};

// product.controller.ts
export class ProductController {
  constructor(private productService: ProductService) {}

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = ListProductsSchema.parse(request.query);
    const result = await this.productService.list(query);
    return reply.send(result);
  };
}

// product.service.ts (Business Logic)
export class ProductService {
  constructor(private productRepository: ProductRepository) {}

  async list(query: ListProductsQuery) {
    // Business logic: filtering, caching, etc.
    const cacheKey = this.getCacheKey(query);
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const products = await this.productRepository.find(query);
    await cache.set(cacheKey, products, 300); // 5 min TTL
    return products;
  }
}

// product.repository.ts (Data Access)
export class ProductRepository {
  async find(query: ListProductsQuery) {
    return prisma.product.findMany({
      where: this.buildWhereClause(query),
      include: { brand: true, category: true },
      // ... pagination, sorting
    });
  }
}
```

**Why This Structure?**
- ✅ **Domain-Driven**: Folders organized by feature (products, brands), not layers (controllers, services)
- ✅ **Screaming Architecture**: You know it's an auto parts system by reading folder names
- ✅ **Easy to Extract**: If "search" becomes slow, extract the `search/` folder to a microservice
- ✅ **Testable**: Each layer can be unit tested in isolation
- ✅ **Scalable**: Add new features without touching existing code

### Agent Services (Python)

```
agents/
├── prospector/
│   ├── app/
│   │   ├── main.py                 # FastAPI app
│   │   ├── scraper/
│   │   │   ├── google_maps.py
│   │   │   ├── supplier_sites.py
│   │   │   └── base_scraper.py
│   │   ├── parser/
│   │   │   ├── lead_extractor.py
│   │   │   └── price_parser.py
│   │   ├── storage/
│   │   │   ├── database.py         # SQLAlchemy models
│   │   │   └── repository.py
│   │   ├── scheduler/
│   │   │   └── tasks.py            # Celery tasks
│   │   ├── scoring/
│   │   │   └── lead_scorer.py
│   │   └── config.py
│   ├── tests/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── celeryconfig.py
│
├── orion/
│   ├── app/
│   │   ├── main.py
│   │   ├── forecasting/
│   │   │   ├── models/
│   │   │   │   ├── sarima.py
│   │   │   │   ├── prophet.py
│   │   │   │   └── ensemble.py
│   │   │   ├── features/
│   │   │   │   ├── seasonality.py
│   │   │   │   ├── weather.py
│   │   │   │   └── car_age.py
│   │   │   └── pipeline.py
│   │   ├── data/
│   │   │   ├── loader.py
│   │   │   ├── preprocessor.py
│   │   │   └── validator.py
│   │   ├── storage/
│   │   │   └── repository.py
│   │   ├── scheduler/
│   │   │   └── tasks.py
│   │   └── config.py
│   ├── models/                     # Saved ML models
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
└── shared/
    ├── database/
    │   └── models.py               # SQLAlchemy models (shared)
    └── utils/
        └── logging.py
```

---

## Authentication & Authorization

### Strategy: JWT-Based Authentication

#### Flow Diagram

```
┌─────────┐                                    ┌─────────┐
│ Admin   │                                    │   API   │
│ User    │                                    │ Server  │
└────┬────┘                                    └────┬────┘
     │                                              │
     │ 1. POST /api/admin/auth/login               │
     │    { email, password }                      │
     ├────────────────────────────────────────────►│
     │                                              │
     │                                      2. Validate credentials
     │                                         (bcrypt.compare)
     │                                              │
     │                                      3. Generate JWT
     │                                         (15 min expiry)
     │                                              │
     │                                      4. Generate refresh token
     │                                         (7 day expiry)
     │                                              │
     │                                      5. Store refresh token in Redis
     │                                              │
     │ 6. Return tokens                            │
     │◄────────────────────────────────────────────┤
     │    { accessToken, refreshToken }            │
     │                                              │
     │ 7. GET /api/admin/products                  │
     │    Header: Authorization: Bearer {token}    │
     ├────────────────────────────────────────────►│
     │                                              │
     │                                      8. Verify JWT
     │                                         (signature + expiry)
     │                                              │
     │ 9. Return data                              │
     │◄────────────────────────────────────────────┤
     │    { data: [...] }                          │
     │                                              │
     │ (After 15 minutes, access token expires)    │
     │                                              │
     │ 10. POST /api/admin/auth/refresh            │
     │     Cookie: refreshToken                    │
     ├────────────────────────────────────────────►│
     │                                              │
     │                                     11. Verify refresh token
     │                                         (check Redis whitelist)
     │                                              │
     │                                     12. Generate new access token
     │                                              │
     │ 13. Return new token                        │
     │◄────────────────────────────────────────────┤
     │    { accessToken }                          │
     │                                              │
```

#### Implementation

```typescript
// shared/auth/jwt.service.ts
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

export class JWTService {
  private readonly ACCESS_TOKEN_SECRET = process.env.JWT_SECRET!;
  private readonly REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET!;

  generateAccessToken(userId: string, email: string, role: string): string {
    return jwt.sign(
      { userId, email, role },
      this.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m', algorithm: 'HS256' }
    );
  }

  generateRefreshToken(userId: string): string {
    const jti = randomUUID(); // Unique token ID
    const token = jwt.sign(
      { userId, jti },
      this.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d', algorithm: 'HS256' }
    );

    // Store in Redis whitelist
    await redis.setex(`refresh:${jti}`, 7 * 24 * 3600, userId);

    return token;
  }

  verifyAccessToken(token: string): { userId: string; email: string; role: string } {
    return jwt.verify(token, this.ACCESS_TOKEN_SECRET) as any;
  }

  async verifyRefreshToken(token: string): Promise<string | null> {
    const decoded = jwt.verify(token, this.REFRESH_TOKEN_SECRET) as any;

    // Check if token in whitelist (not revoked)
    const userId = await redis.get(`refresh:${decoded.jti}`);
    return userId;
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const decoded = jwt.verify(token, this.REFRESH_TOKEN_SECRET) as any;
    await redis.del(`refresh:${decoded.jti}`);
  }
}
```

```typescript
// shared/auth/auth.middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify';

export const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const jwtService = new JWTService();
    const payload = jwtService.verifyAccessToken(token);

    // Attach user info to request
    request.user = payload;
  } catch (error) {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (roles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }
  };
};
```

```typescript
// modules/admin/auth/auth.routes.ts
export const authRoutes = async (fastify: FastifyInstance) => {
  fastify.post('/admin/auth/login', async (request, reply) => {
    const { email, password } = LoginSchema.parse(request.body);

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const jwtService = new JWTService();
    const accessToken = jwtService.generateAccessToken(user.id, user.email, user.role);
    const refreshToken = await jwtService.generateRefreshToken(user.id);

    // Set refresh token as httpOnly cookie
    reply.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 3600 // 7 days
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    return {
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
      accessToken,
      refreshToken
    };
  });

  fastify.post('/admin/auth/refresh', async (request, reply) => {
    const refreshToken = request.cookies.refreshToken;
    if (!refreshToken) {
      return reply.code(401).send({ error: 'No refresh token' });
    }

    const jwtService = new JWTService();
    const userId = await jwtService.verifyRefreshToken(refreshToken);
    if (!userId) {
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      return reply.code(401).send({ error: 'User not found or inactive' });
    }

    const accessToken = jwtService.generateAccessToken(user.id, user.email, user.role);
    return { accessToken };
  });

  fastify.post('/admin/auth/logout', { preHandler: requireAuth }, async (request, reply) => {
    const refreshToken = request.cookies.refreshToken;
    if (refreshToken) {
      const jwtService = new JWTService();
      await jwtService.revokeRefreshToken(refreshToken);
    }

    reply.clearCookie('refreshToken');
    return { success: true };
  });
};
```

### Security Measures

#### Rate Limiting

```typescript
// app.ts
import rateLimit from '@fastify/rate-limit';

await fastify.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  redis: redisClient, // Use Redis for distributed rate limiting
  keyGenerator: (request) => request.ip,
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.'
  })
});

// Custom rate limits for specific routes
fastify.register(rateLimit, {
  max: 5,
  timeWindow: '1 minute',
  prefix: '/api/admin/auth' // Stricter limit for auth endpoints
});
```

#### CORS Configuration

```typescript
// config/cors.config.ts
import { FastifyCorsOptions } from '@fastify/cors';

export const corsConfig: FastifyCorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL!,
      'https://shabouautopieces.tn',
      'https://www.shabouautopieces.tn'
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
```

#### Security Headers

```typescript
// app.ts
import helmet from '@fastify/helmet';

await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:']
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});
```

---

## Caching Strategy

### Three-Tier Caching

```
┌────────────────────────────────────────────┐
│         CACHING ARCHITECTURE               │
├────────────────────────────────────────────┤
│                                            │
│  Tier 1: In-Memory Cache (Node.js Map)    │
│  ├─ Use: Static data (brands, categories) │
│  ├─ TTL: 1 hour                            │
│  ├─ Size: <10MB                            │
│  └─ Invalidation: On admin update          │
│                                            │
│  Tier 2: Redis Cache                       │
│  ├─ Use: Product listings, search results │
│  ├─ TTL: 5-30 minutes                      │
│  ├─ Size: Unlimited (managed by Redis)    │
│  └─ Invalidation: Write-through pattern   │
│                                            │
│  Tier 3: HTTP Cache (Browser + CDN)       │
│  ├─ Use: Static assets, product images    │
│  ├─ TTL: 1 hour - 1 day                   │
│  ├─ Headers: Cache-Control, ETag          │
│  └─ Invalidation: Versioned URLs          │
│                                            │
└────────────────────────────────────────────┘
```

### Implementation

```typescript
// shared/cache/cache.service.ts
import { createHash } from 'crypto';

export class CacheService {
  // Tier 1: In-memory cache
  private memoryCache = new Map<string, { data: any; expiresAt: number }>();

  // Tier 2: Redis cache
  constructor(private redis: Redis) {}

  /**
   * Get from cache (checks memory first, then Redis)
   */
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache
    const memCached = this.memoryCache.get(key);
    if (memCached && memCached.expiresAt > Date.now()) {
      return memCached.data as T;
    }

    // Check Redis
    const redisCached = await this.redis.get(key);
    if (redisCached) {
      return JSON.parse(redisCached) as T;
    }

    return null;
  }

  /**
   * Set in cache (both memory and Redis)
   */
  async set(key: string, data: any, ttlSeconds: number): Promise<void> {
    // Store in memory if small enough
    const dataSize = JSON.stringify(data).length;
    if (dataSize < 100_000) { // <100KB
      this.memoryCache.set(key, {
        data,
        expiresAt: Date.now() + ttlSeconds * 1000
      });
    }

    // Store in Redis
    await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidate(pattern: string): Promise<void> {
    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.match(pattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear Redis cache
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  /**
   * Generate cache key from query params
   */
  generateKey(prefix: string, params: any): string {
    const hash = createHash('md5').update(JSON.stringify(params)).digest('hex');
    return `${prefix}:${hash}`;
  }
}
```

### Cache Invalidation Patterns

#### Pattern 1: Write-Through (for product updates)

```typescript
// product.service.ts
async updateProduct(id: string, data: UpdateProductData) {
  // 1. Update database
  const product = await this.productRepository.update(id, data);

  // 2. Invalidate caches
  await cache.invalidate(`product:${id}`);           // Product detail
  await cache.invalidate('products:list:*');         // All product listings
  await cache.invalidate('search:*');                // Search results
  await cache.invalidate('brands:list');             // Brands (if product count changed)
  await cache.invalidate('categories:list');         // Categories

  // 3. Optionally pre-warm cache for popular queries
  // (Skip for MVP, add later if needed)

  return product;
}
```

#### Pattern 2: Cache-Aside (for reads)

```typescript
// product.service.ts
async getProductBySlug(slug: string): Promise<Product> {
  const cacheKey = `product:slug:${slug}`;

  // 1. Check cache
  const cached = await cache.get<Product>(cacheKey);
  if (cached) {
    return cached;
  }

  // 2. Cache miss - query database
  const product = await this.productRepository.findBySlug(slug, {
    include: { brand: true, category: true }
  });

  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // 3. Store in cache
  await cache.set(cacheKey, product, 600); // 10 minutes

  return product;
}
```

### Cache Monitoring

```typescript
// Prometheus metrics
const cacheHitCounter = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'] // 'memory' or 'redis'
});

const cacheMissCounter = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses'
});

// In CacheService
async get<T>(key: string): Promise<T | null> {
  const memCached = this.memoryCache.get(key);
  if (memCached && memCached.expiresAt > Date.now()) {
    cacheHitCounter.inc({ cache_type: 'memory' });
    return memCached.data as T;
  }

  const redisCached = await this.redis.get(key);
  if (redisCached) {
    cacheHitCounter.inc({ cache_type: 'redis' });
    return JSON.parse(redisCached) as T;
  }

  cacheMissCounter.inc();
  return null;
}
```

**Target**: >80% cache hit ratio for product listings

---

## Performance Optimization

### Database Query Optimization

#### 1. Eager Loading (Avoid N+1 Queries)

```typescript
// ❌ BAD: N+1 query problem
const products = await prisma.product.findMany();
for (const product of products) {
  const brand = await prisma.brand.findUnique({ where: { id: product.brandId } });
  const category = await prisma.category.findUnique({ where: { id: product.categoryId } });
}
// Result: 1 + 2N queries (slow!)

// ✅ GOOD: Eager loading with include
const products = await prisma.product.findMany({
  include: {
    brand: true,
    category: true,
    priceHistory: {
      orderBy: { createdAt: 'desc' },
      take: 1
    }
  }
});
// Result: 1 query with JOINs (fast!)
```

#### 2. Cursor-Based Pagination

```typescript
// ❌ BAD: Offset pagination (slow for large offsets)
const products = await prisma.product.findMany({
  skip: 10000,  // Scans 10,000 rows!
  take: 20
});

// ✅ GOOD: Cursor-based pagination
const products = await prisma.product.findMany({
  cursor: cursor ? { id: cursor } : undefined,
  take: 21, // +1 to check if more results exist
  orderBy: { id: 'asc' }
});

const hasMore = products.length > 20;
const items = products.slice(0, 20);
const nextCursor = hasMore ? items[items.length - 1].id : null;
```

#### 3. Selective Field Loading

```typescript
// ❌ BAD: Load all fields (including large JSONB)
const products = await prisma.product.findMany();

// ✅ GOOD: Select only needed fields
const products = await prisma.product.findMany({
  select: {
    id: true,
    sku: true,
    name: true,
    currentPrice: true,
    primaryImageUrl: true,
    brand: { select: { name: true, slug: true } },
    category: { select: { name: true, slug: true } }
  }
});
```

### Connection Pooling

```typescript
// config/database.config.ts
export const databaseConfig = {
  url: process.env.DATABASE_URL!,
  pool: {
    min: 2,
    max: 10 // Adjust based on load (formula: max = (available_connections - 10) / number_of_app_instances)
  },
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
};
```

### Response Compression

```typescript
// app.ts
import compress from '@fastify/compress';

await fastify.register(compress, {
  threshold: 1024, // Only compress responses >1KB
  encodings: ['gzip', 'deflate'],
  brotli: {
    params: {
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
      [zlib.constants.BROTLI_PARAM_QUALITY]: 4 // Balance between speed and compression
    }
  }
});
```

### Async Operations

```typescript
// ❌ BAD: Synchronous non-critical operations
await sendEmail(user.email, 'Welcome!');
await logAnalytics('user_signup', user.id);
return { success: true };

// ✅ GOOD: Queue non-critical operations
await redisQueue.publish('email_queue', { to: user.email, template: 'welcome' });
await redisQueue.publish('analytics_queue', { event: 'user_signup', userId: user.id });
return { success: true }; // Instant response
```

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Product Listing (p95) | <200ms | Grafana dashboard |
| Product Detail (p95) | <100ms | Grafana dashboard |
| Search (p95) | <300ms | Grafana dashboard |
| Admin Operations (p95) | <500ms | Grafana dashboard |
| Cache Hit Ratio | >80% | Prometheus metric |
| Database Connection Pool | <70% utilization | Prometheus metric |

---

← [Back to Index](./00-INDEX.md) | [Previous: Executive Summary](./01-executive-summary.md) | [Next: Database Design](./03-database-design.md) →
