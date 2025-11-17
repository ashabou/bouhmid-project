const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export interface CreateOrderRequest {
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryRegion?: string;
  postalCode?: string;
  deliveryNotes?: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  paymentMethod: 'CASH_ON_DELIVERY' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'PAYPAL';
}

export interface OrderResponse {
  success: boolean;
  message?: string;
  data?: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
    // ... other order fields
  };
}

export const api = {
  /**
   * Create a new order
   */
  async createOrder(orderData: CreateOrderRequest): Promise<OrderResponse> {
    const response = await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to create order');
    }

    return response.json();
  },

  /**
   * Get order by order number
   */
  async getOrderByNumber(orderNumber: string): Promise<OrderResponse> {
    const response = await fetch(`${API_URL}/orders/number/${orderNumber}`);

    if (!response.ok) {
      throw new Error('Order not found');
    }

    return response.json();
  },

  /**
   * Log search query for analytics
   */
  async logSearchQuery(query: string, resultsCount: number) {
    try {
      // TODO: Implement search query logging endpoint
      console.log('Search logged:', query, resultsCount);
    } catch (error) {
      // Silent fail - don't block user experience
      console.error('Failed to log search:', error);
    }
  },
};
