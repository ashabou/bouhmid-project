-- Migration: Add Orders, OrderItems, and SearchQueries tables
-- Created: 2025-11-17
-- Description: Adds e-commerce transaction tables and analytics tracking

-- Add cost_price column to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2);

-- Create enums for orders
DO $$ BEGIN
    CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PaymentMethod" AS ENUM ('CASH_ON_DELIVERY', 'BANK_TRANSFER', 'CREDIT_CARD', 'PAYPAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,

    -- Customer Info
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50) NOT NULL,

    -- Delivery Address
    delivery_address TEXT NOT NULL,
    delivery_city VARCHAR(100) NOT NULL,
    delivery_region VARCHAR(100),
    postal_code VARCHAR(20),
    delivery_notes TEXT,

    -- Order Totals
    subtotal DECIMAL(10, 2) NOT NULL,
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TND',

    -- Payment
    payment_method "PaymentMethod" NOT NULL,
    payment_status "PaymentStatus" DEFAULT 'PENDING',
    paid_at TIMESTAMPTZ,

    -- Order Status
    status "OrderStatus" DEFAULT 'PENDING',
    confirmed_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    -- Metadata
    ip_address VARCHAR(50),
    user_agent TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

    -- Product Snapshot
    sku VARCHAR(100) NOT NULL,
    product_name VARCHAR(500) NOT NULL,
    product_image VARCHAR(500),

    -- Pricing
    unit_price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Create search_queries table
CREATE TABLE IF NOT EXISTS search_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Query
    query_text VARCHAR(500) NOT NULL,
    query_type VARCHAR(50),

    -- Results
    results_count INTEGER DEFAULT 0,
    matched_products JSONB,
    confidence_score DECIMAL(3, 2),

    -- User Behavior
    converted BOOLEAN DEFAULT FALSE,
    product_clicked UUID,
    time_to_click INTEGER,

    -- Metadata
    session_id VARCHAR(255),
    ip_address VARCHAR(50),
    user_agent TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for search_queries
CREATE INDEX IF NOT EXISTS idx_search_queries_query_text ON search_queries(query_text);
CREATE INDEX IF NOT EXISTS idx_search_queries_converted ON search_queries(converted);
CREATE INDEX IF NOT EXISTS idx_search_queries_created_at ON search_queries(created_at DESC);

-- Create trigger to update updated_at on orders
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
    CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Generate order number sequence for human-readable order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1000;

COMMENT ON TABLE orders IS 'Customer orders for e-commerce transactions';
COMMENT ON TABLE order_items IS 'Line items within each order';
COMMENT ON TABLE search_queries IS 'User search queries for analytics and ML training';
COMMENT ON COLUMN products.cost_price IS 'Product cost for margin calculation';
