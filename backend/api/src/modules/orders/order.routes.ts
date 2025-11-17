import { FastifyInstance } from 'fastify';
import { OrderController } from './order.controller.js';
import { OrderService } from './order.service.js';
import { z } from 'zod';

const createOrderSchema = z.object({
  customerName: z.string().min(2).max(255),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().min(8).max(50),
  deliveryAddress: z.string().min(10),
  deliveryCity: z.string().min(2).max(100),
  deliveryRegion: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  deliveryNotes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().min(1).max(100),
    })
  ).min(1),
  paymentMethod: z.enum(['CASH_ON_DELIVERY', 'BANK_TRANSFER', 'CREDIT_CARD', 'PAYPAL']),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
  cancellationReason: z.string().optional(),
});

export async function orderRoutes(fastify: FastifyInstance) {
  const orderService = new OrderService(fastify.prisma);
  const orderController = new OrderController(orderService);

  // Public routes
  fastify.post('/orders', {
    schema: {
      description: 'Create a new order',
      tags: ['Orders'],
      body: createOrderSchema,
      response: {
        201: {
          description: 'Order created successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
      },
    },
    handler: orderController.create,
  });

  fastify.get('/orders/:id', {
    schema: {
      description: 'Get order by ID',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
    handler: orderController.getById,
  });

  fastify.get('/orders/number/:orderNumber', {
    schema: {
      description: 'Get order by order number',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          orderNumber: { type: 'string' },
        },
      },
    },
    handler: orderController.getByOrderNumber,
  });
}

export async function adminOrderRoutes(fastify: FastifyInstance) {
  const orderService = new OrderService(fastify.prisma);
  const orderController = new OrderController(orderService);

  // Admin routes (requires authentication)
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  fastify.get('/orders', {
    schema: {
      description: 'List all orders',
      tags: ['Admin - Orders'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          customerPhone: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          cursor: { type: 'string' },
        },
      },
    },
    handler: orderController.list,
  });

  fastify.patch('/orders/:id/status', {
    schema: {
      description: 'Update order status',
      tags: ['Admin - Orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: updateOrderStatusSchema,
    },
    handler: orderController.updateStatus,
  });
}
