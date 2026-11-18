-- =====================================================
-- MIGRATION: Make products.tax_rate reference tax_rate_types
-- =====================================================

-- Previously: products.tax_rate was a percentage (NUMERIC)
-- Now: products.tax_rate is an INTEGER FK to tax_rate_types(id)

-- 1. Add temporary column for the FK id
ALTER TABLE products
ADD COLUMN IF NOT EXISTS tax_rate_tmp INTEGER;

-- 2. Migrate existing values (percentage -> type id)
-- Mapping based on seed data in tax_rate_types:
-- 0% -> 3, 2.5% -> 9, 5% -> 8, 10.5% -> 4, 21% -> 5, 27% -> 6
UPDATE products
SET tax_rate_tmp = CASE
    WHEN tax_rate IS NULL THEN 5
    WHEN tax_rate = 0 THEN 3
    WHEN tax_rate = 2.5 THEN 9
    WHEN tax_rate = 5 THEN 8
    WHEN tax_rate = 10.5 THEN 4
    WHEN tax_rate = 21 THEN 5
    WHEN tax_rate = 27 THEN 6
    WHEN tax_rate IN (3, 4, 5, 6, 8, 9) THEN tax_rate::INTEGER
    ELSE 5
END
WHERE tax_rate_tmp IS NULL;

-- 3. Replace column
ALTER TABLE products
DROP COLUMN IF EXISTS tax_rate;

ALTER TABLE products
RENAME COLUMN tax_rate_tmp TO tax_rate;

-- 4. Default + NOT NULL
ALTER TABLE products
ALTER COLUMN tax_rate SET DEFAULT 5;

UPDATE products
SET tax_rate = 5
WHERE tax_rate IS NULL;

ALTER TABLE products
ALTER COLUMN tax_rate SET NOT NULL;

-- 5. Add FK
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'products_tax_rate_fkey'
    ) THEN
        ALTER TABLE products
        ADD CONSTRAINT products_tax_rate_fkey
        FOREIGN KEY (tax_rate) REFERENCES tax_rate_types(id) ON DELETE RESTRICT;
    END IF;
END $$;

COMMENT ON COLUMN products.tax_rate IS 'Tax rate type id (FK to tax_rate_types.id)';
