# Shabou Auto Pièces - API Service

Main API service for the Shabou Auto Pièces e-commerce platform.

## Technology Stack

- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript 5.3+
- **Framework**: Fastify 5.x
- **ORM**: Prisma
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Validation**: Zod
- **Testing**: Jest + Supertest

## Getting Started

### Prerequisites

- Node.js 20 LTS
- PostgreSQL 15+
- Redis 7+

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.development

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed
```

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Check code coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format
```

### Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── modules/           # Domain modules (products, brands, categories, admin)
├── shared/           # Shared services and utilities
│   ├── database/     # Prisma client
│   ├── cache/        # Redis cache service
│   ├── auth/         # JWT authentication
│   ├── logger/       # Winston logging
│   ├── errors/       # Error handling
│   └── utils/        # Utility functions
├── config/           # Configuration files
├── app.ts            # Fastify app setup
└── server.ts         # Entry point
```

## API Documentation

API documentation is available at `/docs` when running in development mode.

## Environment Variables

See `.env.example` for all required environment variables.

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## License

MIT
