import { PrismaClient, Order, OrderItem, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';

export interface CreateOrderDTO {
  // Customer Info
  customerName: string;
  customerEmail?: string;
  customerPhone: string;

  // Delivery
  deliveryAddress: string;
  deliveryCity: string;
  deliveryRegion?: string;
  postalCode?: string;
  deliveryNotes?: string;

  // Items
  items: Array<{
    productId: string;
    quantity: number;
  }>;

  // Payment
  paymentMethod: PaymentMethod;

  // Metadata
  ipAddress?: string;
  userAgent?: string;
}

export interface OrderWithItems extends Order {
  items: Array<OrderItem & {
    product: {
      id: string;
      name: string;
      sku: string;
      currentPrice: number;
      primaryImageUrl: string | null;
    };
  }>;
}

export class OrderService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate unique order number
   */
  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    // Get count of orders today for sequential numbering
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    const todayOrderCount = await this.prisma.order.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequence = (todayOrderCount + 1).toString().padStart(4, '0');
    return `ORD-${year}${month}-${sequence}`;
  }

  /**
   * Create a new order
   */
  async create(data: CreateOrderDTO): Promise<OrderWithItems> {
    // Validate products exist and are in stock
    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: data.items.map(item => item.productId),
        },
        status: 'ACTIVE',
      },
    });

    if (products.length !== data.items.length) {
      throw new Error('One or more products not found or inactive');
    }

    // Check stock availability
    for (const item of data.items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }
      if (!product.inStock || product.stockQuantity < item.quantity) {
        throw new Error(`Product ${product.name} is out of stock or insufficient quantity`);
      }
    }

    // Calculate order totals
    let subtotal = 0;
    const orderItems = data.items.map(item => {
      const product = products.find(p => p.id === item.productId)!;
      const itemSubtotal = Number(product.currentPrice) * item.quantity;
      subtotal += itemSubtotal;

      return {
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        productImage: product.primaryImageUrl,
        unitPrice: product.currentPrice,
        quantity: item.quantity,
        subtotal: itemSubtotal,
      };
    });

    // For now, simple shipping calculation (can be made more sophisticated later)
    const shippingCost = subtotal > 200 ? 0 : 7; // Free shipping over 200 TND
    const totalAmount = subtotal + shippingCost;

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Create order with items in a transaction
    const order = await this.prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          deliveryAddress: data.deliveryAddress,
          deliveryCity: data.deliveryCity,
          deliveryRegion: data.deliveryRegion,
          postalCode: data.postalCode,
          deliveryNotes: data.deliveryNotes,
          subtotal,
          shippingCost,
          totalAmount,
          paymentMethod: data.paymentMethod,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          items: {
            create: orderItems,
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  currentPrice: true,
                  primaryImageUrl: true,
                },
              },
            },
          },
        },
      });

      // Update product stock and order count
      for (const item of data.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
            orderCount: {
              increment: 1,
            },
          },
        });
      }

      return newOrder;
    });

    return order as OrderWithItems;
  }

  /**
   * Get order by ID
   */
  async getById(id: string): Promise<OrderWithItems | null> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                currentPrice: true,
                primaryImageUrl: true,
              },
            },
          },
        },
      },
    });

    return order as OrderWithItems | null;
  }

  /**
   * Get order by order number
   */
  async getByOrderNumber(orderNumber: string): Promise<OrderWithItems | null> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                currentPrice: true,
                primaryImageUrl: true,
              },
            },
          },
        },
      },
    });

    return order as OrderWithItems | null;
  }

  /**
   * Update order status
   */
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const updateData: any = { status };

    // Set timestamps based on status
    switch (status) {
      case 'CONFIRMED':
        updateData.confirmedAt = new Date();
        break;
      case 'SHIPPED':
        updateData.shippedAt = new Date();
        break;
      case 'DELIVERED':
        updateData.deliveredAt = new Date();
        break;
      case 'CANCELLED':
        updateData.cancelledAt = new Date();
        break;
    }

    return await this.prisma.order.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * List orders with pagination
   */
  async list(filters: {
    status?: OrderStatus;
    customerPhone?: string;
    limit?: number;
    cursor?: string;
  }) {
    const { status, customerPhone, limit = 20, cursor } = filters;

    const where: any = {};
    if (status) where.status = status;
    if (customerPhone) where.customerPhone = { contains: customerPhone };

    const orders = await this.prisma.order.findMany({
      where,
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                currentPrice: true,
                primaryImageUrl: true,
              },
            },
          },
        },
      },
    });

    const hasMore = orders.length > limit;
    const results = hasMore ? orders.slice(0, -1) : orders;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    return {
      data: results,
      pagination: {
        hasMore,
        nextCursor,
      },
    };
  }
}
