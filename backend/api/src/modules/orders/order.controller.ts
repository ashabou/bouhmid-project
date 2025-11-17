import { FastifyRequest, FastifyReply } from 'fastify';
import { OrderService, CreateOrderDTO } from './order.service.js';
import { OrderStatus } from '@prisma/client';

export class OrderController {
  constructor(private orderService: OrderService) {}

  /**
   * Create a new order
   * POST /api/v1/orders
   */
  create = async (
    request: FastifyRequest<{ Body: CreateOrderDTO }>,
    reply: FastifyReply
  ) => {
    try {
      // Get client metadata
      const ipAddress = request.ip;
      const userAgent = request.headers['user-agent'];

      const orderData = {
        ...request.body,
        ipAddress,
        userAgent,
      };

      const order = await this.orderService.create(orderData);

      return reply.code(201).send({
        success: true,
        message: 'Order created successfully',
        data: order,
      });
    } catch (error: any) {
      request.log.error({ error }, 'Failed to create order');

      if (error.message.includes('not found') || error.message.includes('out of stock')) {
        return reply.code(400).send({
          success: false,
          message: error.message,
        });
      }

      return reply.code(500).send({
        success: false,
        message: 'Failed to create order',
      });
    }
  };

  /**
   * Get order by ID
   * GET /api/v1/orders/:id
   */
  getById = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    const order = await this.orderService.getById(id);

    if (!order) {
      return reply.code(404).send({
        success: false,
        message: 'Order not found',
      });
    }

    return reply.send({
      success: true,
      data: order,
    });
  };

  /**
   * Get order by order number
   * GET /api/v1/orders/number/:orderNumber
   */
  getByOrderNumber = async (
    request: FastifyRequest<{ Params: { orderNumber: string } }>,
    reply: FastifyReply
  ) => {
    const { orderNumber } = request.params;

    const order = await this.orderService.getByOrderNumber(orderNumber);

    if (!order) {
      return reply.code(404).send({
        success: false,
        message: 'Order not found',
      });
    }

    return reply.send({
      success: true,
      data: order,
    });
  };

  /**
   * List orders (admin only)
   * GET /api/v1/admin/orders
   */
  list = async (
    request: FastifyRequest<{
      Querystring: {
        status?: OrderStatus;
        customerPhone?: string;
        limit?: number;
        cursor?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { status, customerPhone, limit, cursor } = request.query;

    const result = await this.orderService.list({
      status,
      customerPhone,
      limit: limit ? parseInt(limit.toString()) : undefined,
      cursor,
    });

    return reply.send({
      success: true,
      ...result,
    });
  };

  /**
   * Update order status (admin only)
   * PATCH /api/v1/admin/orders/:id/status
   */
  updateStatus = async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: { status: OrderStatus; cancellationReason?: string };
    }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { status, cancellationReason } = request.body;

    try {
      const order = await this.orderService.updateStatus(id, status);

      return reply.send({
        success: true,
        message: 'Order status updated successfully',
        data: order,
      });
    } catch (error: any) {
      request.log.error({ error }, 'Failed to update order status');

      return reply.code(500).send({
        success: false,
        message: 'Failed to update order status',
      });
    }
  };
}
