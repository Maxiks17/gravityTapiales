-- =============================================
-- Migration 0015: Remove stock_quantity from products table
-- =============================================
-- The stock_quantity column on products is now obsolete.
-- Real stock is sourced from:
--   - Simple products: stocks.quantity via products.linked_stock_id
--   - Composite products: calculated as min(stock.quantity / factor) 
--     across all composition ingredients
--
-- The application (productService._enrichWithRealStock) computes 
-- stock_quantity on the fly from the stocks table.
-- =============================================

ALTER TABLE products DROP COLUMN IF EXISTS stock_quantity;
