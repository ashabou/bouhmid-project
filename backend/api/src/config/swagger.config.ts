/**
 * Swagger/OpenAPI Configuration
 * Generates API documentation for Shabou Auto Pièces API
 */

import type { FastifyDynamicSwaggerOptions } from '@fastify/swagger';
import type { FastifySwaggerUiOptions } from '@fastify/swagger-ui';
import { appConfig } from './app.config.js';

/**
 * Swagger/OpenAPI 3.0 configuration
 */
export const swaggerOptions: FastifyDynamicSwaggerOptions = {
  openapi: {
    openapi: '3.0.3',
    info: {
      title: 'Shabou Auto Pièces API',
      description: `
# Shabou Auto Pièces API Documentation

Complete REST API for the Shabou Auto Pièces e-commerce platform.

## Features
- **Product Management**: Browse and search auto parts catalog
- **Brand & Category Management**: Organize products by brands and categories
- **Search**: Multi-criteria search (text, barcode, reference)
- **Admin Portal**: Complete back-office for inventory management
- **Lead Generation**: Integration with Prospector agent
- **Demand Forecasting**: Integration with Orion ML agent

## Authentication
Protected endpoints require a JWT token in the Authorization header:
\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

Obtain a token by authenticating at \`POST /api/v1/admin/auth/login\`

## Rate Limiting
- **Default**: 100 requests per 15 minutes per IP
- **Authenticated users**: Higher limits apply

## Pagination
List endpoints support cursor-based pagination:
- \`cursor\`: Pagination cursor (optional)
- \`limit\`: Number of items (default: 20, max: 100)

## Error Responses
All errors follow a consistent format:
\`\`\`json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Detailed error message"
}
\`\`\`
      `.trim(),
      version: appConfig.api.version,
      contact: {
        name: 'Shabou Auto Pièces',
        url: 'https://shabouautopieces.tn',
        email: 'contact@shabouautopieces.tn',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${appConfig.port}`,
        description: 'Local development server',
      },
      {
        url: 'https://api.shabouautopieces.tn',
        description: 'Production server',
      },
      {
        url: 'https://staging-api.shabouautopieces.tn',
        description: 'Staging server',
      },
    ],
    tags: [
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'Products', description: 'Product catalog endpoints' },
      { name: 'Brands', description: 'Brand management endpoints' },
      { name: 'Categories', description: 'Category management endpoints' },
      { name: 'Search', description: 'Search endpoints (text, barcode, reference)' },
      { name: 'Authentication', description: 'Admin authentication endpoints' },
      { name: 'Admin - Products', description: 'Admin product management' },
      { name: 'Admin - Brands', description: 'Admin brand management' },
      { name: 'Admin - Categories', description: 'Admin category management' },
      { name: 'Admin - Price History', description: 'Price history tracking' },
      { name: 'Admin - Dashboard', description: 'Admin analytics dashboard' },
      { name: 'Admin - Leads', description: 'Lead management (Prospector integration)' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /api/v1/admin/auth/login',
        },
      },
      schemas: {
        // Common schemas
        Error: {
          type: 'object',
          properties: {
            statusCode: { type: 'number', example: 400 },
            error: { type: 'string', example: 'Bad Request' },
            message: { type: 'string', example: 'Validation error' },
          },
          required: ['statusCode', 'error', 'message'],
        },
        Health: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'healthy' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number', example: 12345.67 },
            environment: { type: 'string', example: 'production' },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            nextCursor: { type: 'string', nullable: true },
            hasMore: { type: 'boolean' },
            total: { type: 'number', nullable: true },
          },
        },
        // Product schemas
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            reference: { type: 'string', example: 'REF-12345' },
            name: { type: 'string', example: 'Brake Pad Set Front' },
            description: { type: 'string', nullable: true },
            barcode: { type: 'string', nullable: true },
            price: { type: 'number', format: 'decimal', example: 45.99 },
            stock: { type: 'number', example: 100 },
            minStock: { type: 'number', example: 10 },
            imageUrl: { type: 'string', nullable: true },
            viewCount: { type: 'number', example: 150 },
            brandId: { type: 'string', format: 'uuid' },
            categoryId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            brand: { $ref: '#/components/schemas/Brand' },
            category: { $ref: '#/components/schemas/Category' },
          },
        },
        Brand: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Bosch' },
            slug: { type: 'string', example: 'bosch' },
            logoUrl: { type: 'string', nullable: true },
            description: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Brake System' },
            slug: { type: 'string', example: 'brake-system' },
            description: { type: 'string', nullable: true },
            parentId: { type: 'string', format: 'uuid', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        // Auth schemas
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'admin@shabouautopieces.tn' },
            password: { type: 'string', format: 'password', example: 'SecurePassword123!' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                email: { type: 'string', format: 'email' },
                role: { type: 'string', example: 'ADMIN' },
              },
            },
          },
        },
      },
    },
    security: [],
  },
  transform: ({ schema, url }) => {
    // Transform function to modify schemas before documentation
    return { schema, url };
  },
  transformSpecification: (swaggerObject) => {
    // Additional transformations if needed
    return swaggerObject;
  },
};

/**
 * Swagger UI configuration
 */
export const swaggerUiOptions: FastifySwaggerUiOptions = {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list', // 'list', 'full', or 'none'
    deepLinking: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
    persistAuthorization: true,
  },
  uiHooks: {
    onRequest: function (_request, _reply, next) {
      next();
    },
    preHandler: function (_request, _reply, next) {
      next();
    },
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  transformSpecification: (swaggerObject, _request, _reply) => {
    return swaggerObject;
  },
  transformSpecificationClone: true,
};
