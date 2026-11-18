-- Migration: Add print_separately column to categories table
-- Description: Allows configuring if products from this category should be printed on a separate ticket

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS print_separately BOOLEAN DEFAULT TRUE;

-- Add comment to column
COMMENT ON COLUMN categories.print_separately IS 'If POS has "Print tickets separated by category" enabled, a separate ticket will be printed for this category containing its related products';
