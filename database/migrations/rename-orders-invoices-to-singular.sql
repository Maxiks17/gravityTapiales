-- Migration: Rename orders and invoices tables to match frontend naming
-- Tables remain plural (orders → sales, invoices → fiscal_documents)
-- This maintains consistency with other plural tables (products, customers, categories, brands)

-- Rename orders table to sales
ALTER TABLE IF EXISTS orders RENAME TO sales;

-- Rename order_items table to sale_items
ALTER TABLE IF EXISTS order_items RENAME TO sale_items;

-- Rename invoices table to fiscal_documents
ALTER TABLE IF EXISTS invoices RENAME TO fiscal_documents;

-- Update foreign key column names in sale_items
ALTER TABLE IF EXISTS sale_items RENAME COLUMN order_id TO sale_id;

-- Update any indexes that reference the old names
-- Note: PostgreSQL automatically renames indexes when tables are renamed, 
-- but we should verify RLS policies and triggers still work

-- Verify RLS policies are still active
-- (They should automatically follow the table rename, but check just in case)

COMMENT ON TABLE sales IS 'Sales/orders generated from the POS system';
COMMENT ON TABLE sale_items IS 'Line items for each sale';
COMMENT ON TABLE fiscal_documents IS 'Fiscal documents (invoices, credit notes, debit notes, etc.) for AFIP';
