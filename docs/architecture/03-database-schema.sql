-- ============================================
-- SHABOU AUTO PIÈCES - DATABASE SCHEMA
-- PostgreSQL 15+
-- Version: 1.0
-- Date: 2025-11-14
-- ============================================

-- ENUM Types
CREATE TYPE user_role AS ENUM ('admin', 'staff', 'customer');
CREATE TYPE product_status AS ENUM ('active', 'inactive', 'discontinued', 'out_of_stock');
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'converted', 'rejected');
CREATE TYPE lead_source AS ENUM ('google_maps', 'supplier_website', 'marketplace', 'manual');

-- ============================================
-- CORE E-COMMERCE TABLES
-- ============================================

-- Users (Admin only in Phase 1)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Brands
CREATE TABLE brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    logo_url VARCHAR(500),
    description TEXT,
    country_of_origin VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_brands_slug ON brands(slug);
CREATE INDEX idx_brands_active ON brands(is_active);

-- Categories (Hierarchical)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    level INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_level CHECK (level >= 0 AND level <= 3)
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_active ON categories(is_active);
CREATE INDEX idx_categories_level ON categories(level);

-- Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(500) NOT NULL,
    slug VARCHAR(500) UNIQUE NOT NULL,

    -- Relationships
    brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,

    -- Details
    description TEXT,
    specifications JSONB,

    -- Pricing
    current_price DECIMAL(10, 2) NOT NULL,
    original_price DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'TND',

    -- Inventory
    in_stock BOOLEAN DEFAULT true,
    stock_quantity INTEGER DEFAULT 0,

    -- Media
    images JSONB,
    primary_image_url VARCHAR(500),

    -- SEO
    meta_title VARCHAR(255),
    meta_description VARCHAR(500),

    -- Status
    status product_status DEFAULT 'active',

    -- Auto Parts Specific
    compatible_vehicles JSONB,
    part_number VARCHAR(100),

    -- Metrics
    view_count INTEGER DEFAULT 0,
    order_count INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_price ON products(current_price);
CREATE INDEX idx_products_created ON products(created_at DESC);
CREATE INDEX idx_products_sku ON products(sku);

-- Full-text search index (French language)
CREATE INDEX idx_products_search ON products
    USING GIN(to_tsvector('french',
        coalesce(name, '') || ' ' ||
        coalesce(description, '') || ' ' ||
        coalesce(sku, '')
    ));

-- JSONB indexes
CREATE INDEX idx_products_compatible_vehicles ON products USING GIN(compatible_vehicles);
CREATE INDEX idx_products_specifications ON products USING GIN(specifications);

-- Price History
CREATE TABLE price_history (
    id SERIAL PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    old_price DECIMAL(10, 2),
    new_price DECIMAL(10, 2) NOT NULL,
    changed_by UUID REFERENCES users(id),
    reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_price_history_product ON price_history(product_id, created_at DESC);

-- ============================================
-- PROSPECTOR AGENT TABLES
-- ============================================

-- Leads (potential suppliers/competitors)
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source
    source lead_source NOT NULL,
    source_url VARCHAR(1000),

    -- Business Info
    business_name VARCHAR(500) NOT NULL,
    contact_name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Tunisia',

    -- Categorization
    lead_type VARCHAR(50),

    -- Scraped Data
    products_found JSONB,
    price_competitiveness_score DECIMAL(3, 2),
    website_url VARCHAR(500),
    has_website BOOLEAN DEFAULT false,

    -- Scoring
    potential_score INTEGER,
    notes TEXT,

    -- Status
    status lead_status DEFAULT 'new',
    contacted_at TIMESTAMP WITH TIME ZONE,
    qualified_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_score ON leads(potential_score DESC);
CREATE INDEX idx_leads_scraped_at ON leads(scraped_at DESC);
CREATE INDEX idx_leads_city ON leads(city);

-- Lead Products
CREATE TABLE lead_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

    -- Product Info
    name VARCHAR(500) NOT NULL,
    price DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'TND',
    part_number VARCHAR(100),
    brand VARCHAR(255),

    -- Matching
    matched_product_id UUID REFERENCES products(id),
    price_difference DECIMAL(10, 2),

    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_lead_products_lead ON lead_products(lead_id);
CREATE INDEX idx_lead_products_matched ON lead_products(matched_product_id);

-- ============================================
-- ORION AGENT TABLES (Forecasting)
-- ============================================

-- Sales History
CREATE TABLE sales_history (
    id SERIAL PRIMARY KEY,

    -- Transaction
    sale_date DATE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    sku VARCHAR(100),
    product_name VARCHAR(500),

    -- Quantity & Revenue
    quantity_sold INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_revenue DECIMAL(10, 2) NOT NULL,

    -- Context
    brand_id INTEGER REFERENCES brands(id),
    category_id INTEGER REFERENCES categories(id),
    customer_type VARCHAR(50),

    -- Metadata
    imported_from VARCHAR(50) DEFAULT 'csv',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sales_date ON sales_history(sale_date DESC);
CREATE INDEX idx_sales_product ON sales_history(product_id);
CREATE INDEX idx_sales_sku ON sales_history(sku);
CREATE INDEX idx_sales_category ON sales_history(category_id);
CREATE INDEX idx_sales_brand ON sales_history(brand_id);

-- Forecasts
CREATE TABLE forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Target
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,

    -- Forecast Period
    forecast_date DATE NOT NULL,
    forecast_horizon VARCHAR(20),

    -- Predictions
    predicted_quantity DECIMAL(10, 2) NOT NULL,
    confidence_interval_lower DECIMAL(10, 2),
    confidence_interval_upper DECIMAL(10, 2),
    confidence_score DECIMAL(3, 2),

    -- Model Info
    model_name VARCHAR(100),
    model_version VARCHAR(50),
    features_used JSONB,

    -- Actual (for evaluation)
    actual_quantity DECIMAL(10, 2),
    error DECIMAL(10, 2),

    -- Metadata
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_forecasts_product ON forecasts(product_id);
CREATE INDEX idx_forecasts_date ON forecasts(forecast_date DESC);
CREATE INDEX idx_forecasts_generated ON forecasts(generated_at DESC);
CREATE UNIQUE INDEX idx_forecasts_unique ON forecasts(product_id, forecast_date, forecast_horizon);

-- Forecast Insights
CREATE TABLE forecast_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Type
    insight_type VARCHAR(50),
    severity VARCHAR(20),

    -- Target
    product_id UUID REFERENCES products(id),
    category_id INTEGER REFERENCES categories(id),

    -- Content
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    recommendation TEXT,

    -- Data
    data JSONB,

    -- Status
    is_read BOOLEAN DEFAULT false,
    is_actioned BOOLEAN DEFAULT false,
    actioned_at TIMESTAMP WITH TIME ZONE,

    -- Validity
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_insights_type ON forecast_insights(insight_type);
CREATE INDEX idx_insights_severity ON forecast_insights(severity);
CREATE INDEX idx_insights_product ON forecast_insights(product_id);
CREATE INDEX idx_insights_unread ON forecast_insights(is_read) WHERE is_read = false;
CREATE INDEX idx_insights_valid ON forecast_insights(valid_from, valid_until);

-- ============================================
-- SEED DATA (Example)
-- ============================================

-- Insert default admin user (password: Change@Me123!)
INSERT INTO users (email, password_hash, full_name, role) VALUES
('admin@shabouautopieces.tn', '$2b$10$XxxxxxYourBcryptHashHerexxxxxxxxx', 'Admin User', 'admin');

-- Insert sample brands
INSERT INTO brands (name, slug, country_of_origin) VALUES
('Bosch', 'bosch', 'Germany'),
('Valeo', 'valeo', 'France'),
('Brembo', 'brembo', 'Italy'),
('Mann+Hummel', 'mann-hummel', 'Germany');

-- Insert sample categories
INSERT INTO categories (name, slug, level) VALUES
('Freinage', 'freinage', 0),
('Filtration', 'filtration', 0),
('Électrique', 'electrique', 0);

-- Insert sub-categories
INSERT INTO categories (parent_id, name, slug, level) VALUES
((SELECT id FROM categories WHERE slug = 'freinage'), 'Plaquettes de frein', 'plaquettes-frein', 1),
((SELECT id FROM categories WHERE slug = 'freinage'), 'Disques de frein', 'disques-frein', 1),
((SELECT id FROM categories WHERE slug = 'filtration'), 'Filtres à huile', 'filtres-huile', 1);
