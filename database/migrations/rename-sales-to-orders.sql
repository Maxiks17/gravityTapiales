-- Migration: Rename sales table back to orders and sale_items to order_items
-- This migration reverses the previous rename to use "orders" consistently in the codebase
-- Date: December 2024

-- Step 1: Rename sales table to orders
ALTER TABLE IF EXISTS sales RENAME TO orders;

-- Step 2: Rename sale_items table to order_items
ALTER TABLE IF EXISTS sale_items RENAME TO order_items;

-- Step 3: Update foreign key column names in order_items (sale_id -> order_id)
ALTER TABLE IF EXISTS order_items RENAME COLUMN sale_id TO order_id;

-- Step 4: Update cash_register_closures table column (sale_count -> order_count)
-- Only run if sale_count column exists (it may already be order_count or not exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cash_register_closures' AND column_name = 'sale_count'
    ) THEN
        ALTER TABLE cash_register_closures RENAME COLUMN sale_count TO order_count;
    END IF;
END $$;

-- Step 5: Update any RLS policies that reference the old table names
-- Note: PostgreSQL automatically updates policy names when tables are renamed,
-- but we need to verify the policies are still working correctly

-- Update comments
COMMENT ON TABLE orders IS 'Orders generated from the POS system';
COMMENT ON TABLE order_items IS 'Line items for each order';

-- Step 6: Verify the migration
-- Run these SELECT statements to confirm the tables exist and have data:
-- SELECT COUNT(*) FROM orders;
-- SELECT COUNT(*) FROM order_items;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'order_items';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'cash_register_closures';

-- Note: After running this migration, ensure all RLS policies are still working:
-- SELECT tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename IN ('orders', 'order_items');
