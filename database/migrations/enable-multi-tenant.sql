-- =====================================================
-- MIGRATION: Enable Multi-Tenant Architecture
-- =====================================================
-- This script modifies the database to support multi-tenancy
-- Execute this in Supabase SQL Editor after backing up your data
-- =====================================================

-- =====================================================
-- 1. CREATE TENANTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic Information
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- URL-safe identifier
    
    -- Contact & Settings
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    
    -- Subscription & Billing (for future use)
    subscription_status VARCHAR(20) DEFAULT 'active', -- active, suspended, cancelled
    subscription_plan VARCHAR(50) DEFAULT 'standard',
    billing_email VARCHAR(100),
    
    -- Configuration (JSONB for flexible per-tenant settings)
    settings JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);

-- =====================================================
-- 2. CREATE USER-TENANT JUNCTION TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- User's role within this tenant
    role VARCHAR(20) DEFAULT 'user', -- admin, manager, sales, user
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- A user can only belong to a tenant once
    UNIQUE(user_id, tenant_id)
);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_user_tenants_user ON user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant ON user_tenants(tenant_id);

-- =====================================================
-- 3. ADD TENANT_ID TO EXISTING TABLES
-- =====================================================

-- Categories
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Subcategories
ALTER TABLE subcategories 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Brands
ALTER TABLE brands 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Distributors
ALTER TABLE distributors 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Invoices
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Purchase Orders
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Price Lists
ALTER TABLE price_lists 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Cash Register Closures
ALTER TABLE cash_register_closures 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Settings (change from global to per-tenant)
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Product Distributors (junction table)
ALTER TABLE product_distributors 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- =====================================================
-- 4. CREATE INDEXES FOR TENANT_ID
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_tenant ON subcategories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_brands_tenant ON brands(tenant_id);
CREATE INDEX IF NOT EXISTS idx_distributors_tenant ON distributors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_price_lists_tenant ON price_lists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cash_register_closures_tenant ON cash_register_closures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settings_tenant ON settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_distributors_tenant ON product_distributors(tenant_id);

-- =====================================================
-- 5. CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to get the current user's tenant_id
-- Uses the first active tenant for the user
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM user_tenants
    WHERE user_id = auth.uid() 
      AND is_active = true
    LIMIT 1;
    
    RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Function to auto-populate tenant_id on INSERT for categories
CREATE OR REPLACE FUNCTION auto_set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id := get_user_tenant_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Apply trigger to all tenant-aware tables
DROP TRIGGER IF EXISTS set_tenant_id_categories ON categories;
CREATE TRIGGER set_tenant_id_categories BEFORE INSERT ON categories
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_subcategories ON subcategories;
CREATE TRIGGER set_tenant_id_subcategories BEFORE INSERT ON subcategories
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_brands ON brands;
CREATE TRIGGER set_tenant_id_brands BEFORE INSERT ON brands
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_distributors ON distributors;
CREATE TRIGGER set_tenant_id_distributors BEFORE INSERT ON distributors
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_products ON products;
CREATE TRIGGER set_tenant_id_products BEFORE INSERT ON products
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_customers ON customers;
CREATE TRIGGER set_tenant_id_customers BEFORE INSERT ON customers
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_orders ON orders;
CREATE TRIGGER set_tenant_id_orders BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_invoices ON invoices;
CREATE TRIGGER set_tenant_id_invoices BEFORE INSERT ON invoices
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_purchase_orders ON purchase_orders;
CREATE TRIGGER set_tenant_id_purchase_orders BEFORE INSERT ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_price_lists ON price_lists;
CREATE TRIGGER set_tenant_id_price_lists BEFORE INSERT ON price_lists
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_cash_register_closures ON cash_register_closures;
CREATE TRIGGER set_tenant_id_cash_register_closures BEFORE INSERT ON cash_register_closures
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_settings ON settings;
CREATE TRIGGER set_tenant_id_settings BEFORE INSERT ON settings
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_product_distributors ON product_distributors;
CREATE TRIGGER set_tenant_id_product_distributors BEFORE INSERT ON product_distributors
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

-- =====================================================
-- 6. DROP OLD RLS POLICIES
-- =====================================================
-- We need to drop the old policies and create new tenant-aware ones

-- Categories
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON categories;
DROP POLICY IF EXISTS "Categories are editable by authenticated users" ON categories;

-- Products
DROP POLICY IF EXISTS "Products are viewable by everyone" ON products;
DROP POLICY IF EXISTS "Products are editable by authenticated users" ON products;

-- Customers
DROP POLICY IF EXISTS "Customers are viewable by authenticated users" ON customers;
DROP POLICY IF EXISTS "Customers are editable by authenticated users" ON customers;

-- Orders
DROP POLICY IF EXISTS "Orders are viewable by authenticated users" ON orders;
DROP POLICY IF EXISTS "Orders are editable by authenticated users" ON orders;

-- Order Items
DROP POLICY IF EXISTS "Order items are viewable by authenticated users" ON order_items;
DROP POLICY IF EXISTS "Order items are editable by authenticated users" ON order_items;

-- Invoices
DROP POLICY IF EXISTS "Invoices are viewable by authenticated users" ON invoices;
DROP POLICY IF EXISTS "Invoices are editable by authenticated users" ON invoices;

-- Purchase Orders
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON purchase_orders;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON purchase_orders;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON purchase_orders;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON purchase_orders;

-- Purchase Order Items
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON purchase_order_items;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON purchase_order_items;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON purchase_order_items;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON purchase_order_items;

-- Product Distributors
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON product_distributors;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON product_distributors;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON product_distributors;
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON product_distributors;

-- Price Lists
DROP POLICY IF EXISTS "Enable read access for all users" ON price_lists;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON price_lists;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON price_lists;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON price_lists;

-- Cash Register Closures
DROP POLICY IF EXISTS "Users can view all closures" ON cash_register_closures;
DROP POLICY IF EXISTS "Users can insert closures" ON cash_register_closures;

-- Settings
DROP POLICY IF EXISTS "Users can view settings" ON settings;
DROP POLICY IF EXISTS "Users can update settings" ON settings;
DROP POLICY IF EXISTS "Users can insert settings" ON settings;

-- =====================================================
-- 7. CREATE NEW TENANT-AWARE RLS POLICIES
-- =====================================================

-- Helper: Create standard tenant-isolated policies for a table
-- Users can only see/modify data belonging to their tenant

-- Categories
DROP POLICY IF EXISTS "tenant_isolation_select" ON categories;
CREATE POLICY "tenant_isolation_select" ON categories
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_insert" ON categories;
CREATE POLICY "tenant_isolation_insert" ON categories
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_update" ON categories;
CREATE POLICY "tenant_isolation_update" ON categories
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_delete" ON categories;
CREATE POLICY "tenant_isolation_delete" ON categories
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- Subcategories
DROP POLICY IF EXISTS "tenant_isolation_select" ON subcategories;
CREATE POLICY "tenant_isolation_select" ON subcategories
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_insert" ON subcategories;
CREATE POLICY "tenant_isolation_insert" ON subcategories
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_update" ON subcategories;
CREATE POLICY "tenant_isolation_update" ON subcategories
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_delete" ON subcategories;
CREATE POLICY "tenant_isolation_delete" ON subcategories
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- Brands
DROP POLICY IF EXISTS "tenant_isolation_select" ON brands;
CREATE POLICY "tenant_isolation_select" ON brands
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_insert" ON brands;
CREATE POLICY "tenant_isolation_insert" ON brands
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_update" ON brands;
CREATE POLICY "tenant_isolation_update" ON brands
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_delete" ON brands;
CREATE POLICY "tenant_isolation_delete" ON brands
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- Distributors
DROP POLICY IF EXISTS "tenant_isolation_select" ON distributors;
CREATE POLICY "tenant_isolation_select" ON distributors
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_insert" ON distributors;
CREATE POLICY "tenant_isolation_insert" ON distributors
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_update" ON distributors;
CREATE POLICY "tenant_isolation_update" ON distributors
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_delete" ON distributors;
CREATE POLICY "tenant_isolation_delete" ON distributors
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- Products
DROP POLICY IF EXISTS "tenant_isolation_select" ON products;
CREATE POLICY "tenant_isolation_select" ON products
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_insert" ON products;
CREATE POLICY "tenant_isolation_insert" ON products
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_update" ON products;
CREATE POLICY "tenant_isolation_update" ON products
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_delete" ON products;
CREATE POLICY "tenant_isolation_delete" ON products
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- Customers
DROP POLICY IF EXISTS "tenant_isolation_select" ON customers;
CREATE POLICY "tenant_isolation_select" ON customers
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_insert" ON customers;
CREATE POLICY "tenant_isolation_insert" ON customers
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_update" ON customers;
CREATE POLICY "tenant_isolation_update" ON customers
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_delete" ON customers;
CREATE POLICY "tenant_isolation_delete" ON customers
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- Orders
DROP POLICY IF EXISTS "tenant_isolation_select" ON orders;
CREATE POLICY "tenant_isolation_select" ON orders
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_insert" ON orders;
CREATE POLICY "tenant_isolation_insert" ON orders
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_update" ON orders;
CREATE POLICY "tenant_isolation_update" ON orders
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_delete" ON orders;
CREATE POLICY "tenant_isolation_delete" ON orders
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- Order Items (inherits from parent order's tenant)
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_select" ON order_items;
CREATE POLICY "tenant_isolation_select" ON order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_items.order_id 
              AND orders.tenant_id = get_user_tenant_id()
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_insert" ON order_items;
CREATE POLICY "tenant_isolation_insert" ON order_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_items.order_id 
              AND orders.tenant_id = get_user_tenant_id()
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_update" ON order_items;
CREATE POLICY "tenant_isolation_update" ON order_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_items.order_id 
              AND orders.tenant_id = get_user_tenant_id()
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_delete" ON order_items;
CREATE POLICY "tenant_isolation_delete" ON order_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_items.order_id 
              AND orders.tenant_id = get_user_tenant_id()
        )
    );

-- Invoices
DROP POLICY IF EXISTS "tenant_isolation_select" ON invoices;
CREATE POLICY "tenant_isolation_select" ON invoices
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_insert" ON invoices;
CREATE POLICY "tenant_isolation_insert" ON invoices
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_update" ON invoices;
CREATE POLICY "tenant_isolation_update" ON invoices
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_delete" ON invoices;
CREATE POLICY "tenant_isolation_delete" ON invoices
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- Purchase Orders
DROP POLICY IF EXISTS "tenant_isolation_select" ON purchase_orders;
CREATE POLICY "tenant_isolation_select" ON purchase_orders
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_insert" ON purchase_orders;
CREATE POLICY "tenant_isolation_insert" ON purchase_orders
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_update" ON purchase_orders;
CREATE POLICY "tenant_isolation_update" ON purchase_orders
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_delete" ON purchase_orders;
CREATE POLICY "tenant_isolation_delete" ON purchase_orders
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- Purchase Order Items (inherits from parent purchase_order's tenant)
DROP POLICY IF EXISTS "tenant_isolation_select" ON purchase_order_items;
CREATE POLICY "tenant_isolation_select" ON purchase_order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM purchase_orders 
            WHERE purchase_orders.id = purchase_order_items.purchase_order_id 
              AND purchase_orders.tenant_id = get_user_tenant_id()
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_insert" ON purchase_order_items;
CREATE POLICY "tenant_isolation_insert" ON purchase_order_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM purchase_orders 
            WHERE purchase_orders.id = purchase_order_items.purchase_order_id 
              AND purchase_orders.tenant_id = get_user_tenant_id()
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_update" ON purchase_order_items;
CREATE POLICY "tenant_isolation_update" ON purchase_order_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM purchase_orders 
            WHERE purchase_orders.id = purchase_order_items.purchase_order_id 
              AND purchase_orders.tenant_id = get_user_tenant_id()
        )
    );

DROP POLICY IF EXISTS "tenant_isolation_delete" ON purchase_order_items;
CREATE POLICY "tenant_isolation_delete" ON purchase_order_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM purchase_orders 
            WHERE purchase_orders.id = purchase_order_items.purchase_order_id 
              AND purchase_orders.tenant_id = get_user_tenant_id()
        )
    );

-- Product Distributors
DROP POLICY IF EXISTS "tenant_isolation_select" ON product_distributors;
CREATE POLICY "tenant_isolation_select" ON product_distributors
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_insert" ON product_distributors;
CREATE POLICY "tenant_isolation_insert" ON product_distributors
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_update" ON product_distributors;
CREATE POLICY "tenant_isolation_update" ON product_distributors
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_delete" ON product_distributors;
CREATE POLICY "tenant_isolation_delete" ON product_distributors
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- Price Lists
DROP POLICY IF EXISTS "tenant_isolation_select" ON price_lists;
CREATE POLICY "tenant_isolation_select" ON price_lists
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_insert" ON price_lists;
CREATE POLICY "tenant_isolation_insert" ON price_lists
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_update" ON price_lists;
CREATE POLICY "tenant_isolation_update" ON price_lists
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_delete" ON price_lists;
CREATE POLICY "tenant_isolation_delete" ON price_lists
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- Cash Register Closures
DROP POLICY IF EXISTS "tenant_isolation_select" ON cash_register_closures;
CREATE POLICY "tenant_isolation_select" ON cash_register_closures
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_insert" ON cash_register_closures;
CREATE POLICY "tenant_isolation_insert" ON cash_register_closures
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_update" ON cash_register_closures;
CREATE POLICY "tenant_isolation_update" ON cash_register_closures
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_delete" ON cash_register_closures;
CREATE POLICY "tenant_isolation_delete" ON cash_register_closures
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- Settings
-- Allow unique constraint on (tenant_id, key) combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_tenant_key ON settings(tenant_id, key);

-- Drop old unique constraint on key alone if it exists
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;

DROP POLICY IF EXISTS "tenant_isolation_select" ON settings;
CREATE POLICY "tenant_isolation_select" ON settings
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_insert" ON settings;
CREATE POLICY "tenant_isolation_insert" ON settings
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_update" ON settings;
CREATE POLICY "tenant_isolation_update" ON settings
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "tenant_isolation_delete" ON settings;
CREATE POLICY "tenant_isolation_delete" ON settings
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- =====================================================
-- 8. ENABLE RLS ON TABLES AND CREATE TENANT/USER_TENANT POLICIES
-- =====================================================
-- Now that user_tenants exists, we can create policies that reference it

-- Enable RLS on tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Tenants are viewable by authenticated users belonging to that tenant
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
CREATE POLICY "Users can view their own tenant" ON tenants
    FOR SELECT USING (
        id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
    );

-- Only admins can manage tenants (we'll refine this later)
DROP POLICY IF EXISTS "Admins can manage tenants" ON tenants;
CREATE POLICY "Admins can manage tenants" ON tenants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Enable RLS on user_tenants
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;

-- Users can see their own tenant associations
DROP POLICY IF EXISTS "Users can view their own tenant associations" ON user_tenants;
CREATE POLICY "Users can view their own tenant associations" ON user_tenants
    FOR SELECT USING (user_id = auth.uid());

-- =====================================================
-- 9. DATA MIGRATION: ASSIGN EXISTING DATA TO DEFAULT TENANT
-- =====================================================
-- Create a default tenant for existing data
-- IMPORTANT: Run this only once!

DO $$
DECLARE
    v_default_tenant_id UUID;
    v_first_user_id UUID;
BEGIN
    -- Check if we already have a default tenant
    SELECT id INTO v_default_tenant_id FROM tenants WHERE slug = 'default' LIMIT 1;
    
    -- If no default tenant exists, create it
    IF v_default_tenant_id IS NULL THEN
        INSERT INTO tenants (name, slug, is_active)
        VALUES ('Default Organization', 'default', true)
        RETURNING id INTO v_default_tenant_id;
        
        RAISE NOTICE 'Created default tenant with ID: %', v_default_tenant_id;
    END IF;
    
    -- Get the first user (if any) to associate with the default tenant
    SELECT id INTO v_first_user_id FROM auth.users LIMIT 1;
    
    -- If we have users, associate them all with the default tenant
    IF v_first_user_id IS NOT NULL THEN
        INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
        SELECT id, v_default_tenant_id, 'admin', true
        FROM auth.users
        ON CONFLICT (user_id, tenant_id) DO NOTHING;
        
        RAISE NOTICE 'Associated all existing users with default tenant';
    END IF;
    
    -- Update all existing data to belong to the default tenant
    UPDATE categories SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE subcategories SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE brands SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE distributors SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE products SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE customers SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE orders SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE invoices SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE purchase_orders SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE price_lists SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE cash_register_closures SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE settings SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    UPDATE product_distributors SET tenant_id = v_default_tenant_id WHERE tenant_id IS NULL;
    
    RAISE NOTICE 'Migrated all existing data to default tenant';
END $$;

-- =====================================================
-- 10. MAKE TENANT_ID REQUIRED (NOT NULL)
-- =====================================================
-- After migration, enforce that all new records must have a tenant_id

-- ALTER TABLE categories ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE subcategories ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE brands ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE distributors ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE products ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE customers ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE orders ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE invoices ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE purchase_orders ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE price_lists ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE cash_register_closures ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE settings ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE product_distributors ALTER COLUMN tenant_id SET NOT NULL;

-- NOTE: Uncomment the above ALTER TABLE statements after verifying the migration
-- This ensures data integrity for future inserts

-- =====================================================
-- 11. UPDATE HANDLE_NEW_USER FUNCTION
-- =====================================================
-- Modify the user registration trigger to handle tenant assignment
-- EACH NEW USER GETS THEIR OWN DISTRIBUTOR/TENANT

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_tenant_name TEXT;
    v_tenant_slug TEXT;
BEGIN
    -- Create a unique tenant name and slug for this user
    v_tenant_name := 'Distribuidora ' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8);
    v_tenant_slug := 'dist-' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8);
    
    -- Create a new tenant (distributor) for this user
    INSERT INTO tenants (name, slug, is_active, settings)
    VALUES (
        v_tenant_name,
        v_tenant_slug,
        true,
        '{"is_setup_complete": false}'::jsonb  -- Flag to indicate setup is not complete
    )
    RETURNING id INTO v_tenant_id;
    
    -- Create user profile (ignore if already exists)
    INSERT INTO public.user_profiles (id, full_name, role)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'admin')
    ON CONFLICT (id) DO NOTHING;
    
    -- Associate user with their new tenant as admin
    INSERT INTO public.user_tenants (user_id, tenant_id, role, is_active)
    VALUES (NEW.id, v_tenant_id, 'admin', true)
    ON CONFLICT (user_id, tenant_id) DO NOTHING;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail user creation
        RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Your database is now multi-tenant enabled!
-- 
-- Next steps:
-- 1. Verify the migration worked correctly
-- 2. Update your application code to handle tenants
-- 3. Test with multiple tenants
-- 4. Uncomment the NOT NULL constraints when ready
-- =====================================================
