-- =============================================
-- Migration 0014: Change order_items.quantity from INTEGER to NUMERIC
-- =============================================
-- This allows selling fractional quantities (e.g., 1.5 liters, 0.250 kg)
-- which is needed for products with allows_custom_quantity = true
-- and composite products sold by weight/volume.
--
-- The existing process_sale_stock_deduction function already uses NUMERIC
-- internally, so no changes needed there.
-- =============================================

ALTER TABLE order_items
    ALTER COLUMN quantity TYPE NUMERIC(10, 4)
    USING quantity::NUMERIC(10, 4);
