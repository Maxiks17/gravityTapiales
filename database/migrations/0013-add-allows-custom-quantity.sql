-- Migration: Add allows_custom_quantity field to products
-- This allows products (especially composite ones) to be sold with custom quantities
-- Example: "Almendras al granel x 100gr" can be sold as 155gr (1.55 units)

ALTER TABLE products
ADD COLUMN IF NOT EXISTS allows_custom_quantity BOOLEAN DEFAULT false;

COMMENT ON COLUMN products.allows_custom_quantity IS 'When true, POS will prompt for custom quantity instead of incrementing by 1';
database/migrations/0013-add-allows-custom-quantity.sql