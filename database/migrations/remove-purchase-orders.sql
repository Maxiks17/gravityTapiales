-- Migration to remove purchase orders functionality
-- This script removes all tables, triggers, functions, and policies related to purchase orders
-- Safe to run even if tables don't exist

-- Drop indexes for purchase_order_items (must be done before policies if table exists)
DROP INDEX IF EXISTS idx_purchase_order_items_order;
DROP INDEX IF EXISTS idx_purchase_order_items_product;

-- Drop indexes for purchase_orders
DROP INDEX IF EXISTS idx_purchase_orders_distributor;
DROP INDEX IF EXISTS idx_purchase_orders_status;
DROP INDEX IF EXISTS idx_purchase_orders_order_date;

-- Drop indexes for product_distributors
DROP INDEX IF EXISTS idx_product_distributors_product;
DROP INDEX IF EXISTS idx_product_distributors_distributor;

-- Drop tables in correct order (child tables first, then parent tables)
-- Using CASCADE to automatically drop dependent objects (policies, triggers, etc.)
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS product_distributors CASCADE;

-- Note: The update_updated_at_column() function is NOT dropped because it's used by other tables in the system
