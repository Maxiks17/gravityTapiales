-- =====================================================
-- MIGRATION: Tables Management and Operation Modes
-- =====================================================
-- This migration adds support for:
-- 1. Restaurant tables management
-- 2. Order lifecycle status (OPEN, PENDING, COMPLETED)
-- 3. Multi-mode operation (RESTAURANTE, KIOSCO, DISTRIBUIDOR)

-- =====================================================
-- 1. CREATE TABLES TABLE (for restaurant mode)
-- =====================================================
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'FREE' CHECK (status IN ('FREE', 'OCCUPIED', 'RESERVED')),
    capacity INTEGER DEFAULT 4,
    location VARCHAR(100), -- e.g., "Patio", "Interior", "Terraza"
    position_x INTEGER DEFAULT 0, -- For visual layout
    position_y INTEGER DEFAULT 0, -- For visual layout
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for tenant_id
CREATE INDEX IF NOT EXISTS idx_tables_tenant_id ON tables(tenant_id);

-- =====================================================
-- 2. MODIFY ORDERS TABLE
-- =====================================================
-- Add table_id column (nullable for KIOSCO and DISTRIBUIDOR modes)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' AND column_name = 'table_id') THEN
        ALTER TABLE orders ADD COLUMN table_id UUID REFERENCES tables(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Make customer_id nullable (for restaurant mode where customer may not be assigned initially)
ALTER TABLE orders ALTER COLUMN customer_id DROP NOT NULL;

-- Update status column to support new values
-- Note: The existing status column already accepts varchar, we just need to update valid values
-- New statuses: OPEN (for restaurant), PENDING (for distributor), COMPLETED, CANCELLED
-- We'll keep backward compatibility with existing statuses

-- Add index for table_id
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);

-- =====================================================
-- 3. RLS POLICIES FOR TABLES
-- =====================================================
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT - User can see tables from their tenant
DROP POLICY IF EXISTS "tables_select_policy" ON tables;
CREATE POLICY "tables_select_policy" ON tables
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM user_tenants 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Policy for INSERT - User can create tables for their tenant
DROP POLICY IF EXISTS "tables_insert_policy" ON tables;
CREATE POLICY "tables_insert_policy" ON tables
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id 
            FROM user_tenants 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Policy for UPDATE - User can update tables from their tenant
DROP POLICY IF EXISTS "tables_update_policy" ON tables;
CREATE POLICY "tables_update_policy" ON tables
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM user_tenants 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Policy for DELETE - User can delete tables from their tenant
DROP POLICY IF EXISTS "tables_delete_policy" ON tables;
CREATE POLICY "tables_delete_policy" ON tables
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM user_tenants 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- =====================================================
-- 4. TRIGGER FOR UPDATED_AT AND AUTO-SET TENANT_ID
-- =====================================================
CREATE OR REPLACE FUNCTION update_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tables_updated_at ON tables;
CREATE TRIGGER tables_updated_at
    BEFORE UPDATE ON tables
    FOR EACH ROW
    EXECUTE FUNCTION update_tables_updated_at();

-- Auto-set tenant_id on INSERT (uses function from enable-multi-tenant.sql)
DROP TRIGGER IF EXISTS set_tenant_id_tables ON tables;
CREATE TRIGGER set_tenant_id_tables 
    BEFORE INSERT ON tables
    FOR EACH ROW 
    EXECUTE FUNCTION auto_set_tenant_id();

-- =====================================================
-- 5. STATUS MAPPING COMMENTS
-- =====================================================
-- Order Status Values:
-- - 'open'       : Active order in restaurant mode (table occupied)
-- - 'pending'    : Awaiting delivery in distributor mode
-- - 'confirmed'  : Order confirmed (legacy support)
-- - 'preparing'  : Being prepared (legacy support)
-- - 'shipped'    : Shipped (legacy support)  
-- - 'delivered'  : Delivered/completed in distributor mode
-- - 'completed'  : Completed (closed) - final state for all modes
-- - 'cancelled'  : Cancelled order

-- Table Status Values:
-- - 'FREE'       : Table is available
-- - 'OCCUPIED'   : Table has an active order
-- - 'RESERVED'   : Table is reserved for future use

-- =====================================================
-- 6. SAMPLE DATA (Optional - uncomment if needed)
-- =====================================================
-- INSERT INTO tables (tenant_id, name, capacity, location) VALUES
--     ('YOUR_TENANT_ID', 'Mesa 1', 4, 'Interior'),
--     ('YOUR_TENANT_ID', 'Mesa 2', 4, 'Interior'),
--     ('YOUR_TENANT_ID', 'Mesa 3', 2, 'Barra'),
--     ('YOUR_TENANT_ID', 'Mesa 4', 6, 'Patio');
