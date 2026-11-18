-- =====================================================
-- MIGRATION: Remove Price Lists Feature
-- =====================================================
-- This migration removes all price list functionality including:
-- - price_lists table
-- - price_list_id column from customers table
-- - applied_price_list_id and applied_adjustment_value from orders table
-- - All related RLS policies, triggers, and indexes

-- 1. Drop foreign key constraints first
ALTER TABLE customers
DROP CONSTRAINT IF EXISTS customers_price_list_id_fkey;

ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_applied_price_list_id_fkey;

-- 2. Drop columns from customers table
ALTER TABLE customers
DROP COLUMN IF EXISTS price_list_id;

-- 3. Drop columns from orders table
ALTER TABLE orders
DROP COLUMN IF EXISTS applied_price_list_id,
DROP COLUMN IF EXISTS applied_adjustment_value;

-- 4. Drop all RLS policies for price_lists
DROP POLICY IF EXISTS "Enable read access for all users" ON price_lists;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON price_lists;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON price_lists;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON price_lists;
DROP POLICY IF EXISTS "tenant_isolation_select" ON price_lists;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON price_lists;
DROP POLICY IF EXISTS "tenant_isolation_update" ON price_lists;
DROP POLICY IF EXISTS "tenant_isolation_delete" ON price_lists;

-- 5. Drop triggers
DROP TRIGGER IF EXISTS set_tenant_id_price_lists ON price_lists;

-- 6. Drop indexes
DROP INDEX IF EXISTS idx_price_lists_tenant;

-- 7. Drop the price_lists table
DROP TABLE IF EXISTS price_lists CASCADE;

-- =====================================================
-- Migration Complete
-- =====================================================
-- All price list related database objects have been removed
-- Foreign key references have been cleaned up
-- No orphaned data remains
