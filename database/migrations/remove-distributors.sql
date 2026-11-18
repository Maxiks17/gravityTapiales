-- =====================================================
-- MIGRATION: Remove Distributors
-- Description: Removes distributors table and product_distributors junction table
-- Date: 2025-11-30
-- Note: This script is safe to run even if tables don't exist
-- =====================================================

-- First, check if we need to do anything
DO $$
BEGIN
    -- Only proceed if either table exists
    IF EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('distributors', 'product_distributors')
    ) THEN
        RAISE NOTICE 'Found distributor-related tables, proceeding with cleanup...';
    ELSE
        RAISE NOTICE 'No distributor tables found, migration already complete or not needed.';
    END IF;
END $$;

-- =====================================================
-- 1. DROP TRIGGERS (only if tables exist)
-- =====================================================

-- Drop triggers for distributors table
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'distributors') THEN
        DROP TRIGGER IF EXISTS set_tenant_id_distributors ON distributors;
        RAISE NOTICE 'Dropped triggers for distributors table';
    END IF;
END $$;

-- Drop triggers for product_distributors table
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_distributors') THEN
        DROP TRIGGER IF EXISTS set_tenant_id_product_distributors ON product_distributors;
        RAISE NOTICE 'Dropped triggers for product_distributors table';
    END IF;
END $$;

-- =====================================================
-- 2. DROP RLS POLICIES (only if tables exist)
-- =====================================================

-- Drop RLS policies for distributors
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'distributors') THEN
        DROP POLICY IF EXISTS "tenant_isolation_select" ON distributors;
        DROP POLICY IF EXISTS "tenant_isolation_insert" ON distributors;
        DROP POLICY IF EXISTS "tenant_isolation_update" ON distributors;
        DROP POLICY IF EXISTS "tenant_isolation_delete" ON distributors;
        DROP POLICY IF EXISTS "Enable read access for authenticated users" ON distributors;
        DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON distributors;
        DROP POLICY IF EXISTS "Enable update access for authenticated users" ON distributors;
        DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON distributors;
        RAISE NOTICE 'Dropped RLS policies for distributors table';
    END IF;
END $$;

-- Drop RLS policies for product_distributors
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_distributors') THEN
        DROP POLICY IF EXISTS "tenant_isolation_select" ON product_distributors;
        DROP POLICY IF EXISTS "tenant_isolation_insert" ON product_distributors;
        DROP POLICY IF EXISTS "tenant_isolation_update" ON product_distributors;
        DROP POLICY IF EXISTS "tenant_isolation_delete" ON product_distributors;
        DROP POLICY IF EXISTS "Enable read access for authenticated users" ON product_distributors;
        DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON product_distributors;
        DROP POLICY IF EXISTS "Enable update access for authenticated users" ON product_distributors;
        DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON product_distributors;
        RAISE NOTICE 'Dropped RLS policies for product_distributors table';
    END IF;
END $$;

-- =====================================================
-- 3. DROP INDEXES
-- =====================================================

-- Drop indexes for distributors table
DROP INDEX IF EXISTS idx_distributors_tenant;
DROP INDEX IF EXISTS idx_distributors_tenant_id;

-- Drop indexes for product_distributors table
DROP INDEX IF EXISTS idx_product_distributors_tenant;
DROP INDEX IF EXISTS idx_product_distributors_tenant_id;
DROP INDEX IF EXISTS idx_product_distributors_product;
DROP INDEX IF EXISTS idx_product_distributors_product_id;

-- Drop indexes for purchase_orders table (distributor_id foreign key)
DROP INDEX IF EXISTS idx_purchase_orders_distributor;
DROP INDEX IF EXISTS idx_purchase_orders_distributor_id;

-- =====================================================
-- 4. DROP FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Remove distributor_id foreign key constraint from purchase_orders table if it exists
ALTER TABLE IF EXISTS purchase_orders
DROP CONSTRAINT IF EXISTS purchase_orders_distributor_id_fkey;

-- Remove foreign key constraints from product_distributors table
ALTER TABLE IF EXISTS product_distributors
DROP CONSTRAINT IF EXISTS product_distributors_product_id_fkey;

ALTER TABLE IF EXISTS product_distributors
DROP CONSTRAINT IF EXISTS product_distributors_distributor_id_fkey;

ALTER TABLE IF EXISTS product_distributors
DROP CONSTRAINT IF EXISTS product_distributors_tenant_id_fkey;

-- =====================================================
-- 5. DROP COLUMNS FROM RELATED TABLES
-- =====================================================

-- Remove distributor_id column from purchase_orders table if it exists
ALTER TABLE IF EXISTS purchase_orders
DROP COLUMN IF EXISTS distributor_id;

-- =====================================================
-- 6. DROP TABLES
-- =====================================================

-- Drop product_distributors junction table first (has foreign keys to distributors)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'product_distributors') THEN
        DROP TABLE product_distributors CASCADE;
        RAISE NOTICE 'Dropped product_distributors table';
    ELSE
        RAISE NOTICE 'Table product_distributors does not exist, skipping';
    END IF;
END $$;

-- Drop distributors table
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'distributors') THEN
        DROP TABLE distributors CASCADE;
        RAISE NOTICE 'Dropped distributors table';
    ELSE
        RAISE NOTICE 'Table distributors does not exist, skipping';
    END IF;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration complete: Distributors removed';
    RAISE NOTICE '==============================================';
END $$;

-- Note: This migration removes all distributor-related functionality:
-- - distributors table (suppliers/vendors)
-- - product_distributors junction table (many-to-many relationship)
-- - distributor_id column from purchase_orders table
-- - All associated triggers, policies, indexes, and constraints
--
-- This script is safe to run multiple times and will not fail if tables don't exist.
