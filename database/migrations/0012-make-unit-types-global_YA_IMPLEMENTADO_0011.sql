-- =============================================
-- Migration: Make unit_types global (remove tenant_id)
-- Description: Converts unit_types from per-tenant to global table
-- Author: System
-- Date: 2025-02-03
-- =============================================

-- =============================================
-- 1. Identify which unit_type IDs to keep (first one per code)
-- =============================================
CREATE TEMP TABLE unit_types_to_keep AS
SELECT DISTINCT ON (code)
    id,
    code,
    name,
    allows_decimals
FROM unit_types
ORDER BY code, created_at ASC;

-- =============================================
-- 2. Create mapping from duplicate IDs to the ID we're keeping
-- =============================================
CREATE TEMP TABLE unit_type_mapping AS
SELECT
    ut.id as old_id,
    utk.id as new_id
FROM unit_types ut
JOIN unit_types_to_keep utk ON ut.code = utk.code
WHERE ut.id != utk.id;

-- =============================================
-- 3. Update stocks to point to the IDs we're keeping
-- =============================================
UPDATE stocks s
SET unit_type_id = m.new_id
FROM unit_type_mapping m
WHERE s.unit_type_id = m.old_id;

-- =============================================
-- 4. Delete duplicate unit_types (keep only one per code)
-- =============================================
DELETE FROM unit_types
WHERE id IN (SELECT old_id FROM unit_type_mapping);

-- =============================================
-- 5. Drop RLS policies on unit_types
-- =============================================
DROP POLICY IF EXISTS "Users can view unit_types from their tenant" ON unit_types;
DROP POLICY IF EXISTS "Users can insert unit_types for their tenant" ON unit_types;
DROP POLICY IF EXISTS "Users can update unit_types from their tenant" ON unit_types;
DROP POLICY IF EXISTS "Users can delete unit_types from their tenant" ON unit_types;

-- =============================================
-- 6. Drop trigger and function for auto tenant_id
-- =============================================
DROP TRIGGER IF EXISTS set_tenant_id_unit_types ON unit_types;
DROP FUNCTION IF EXISTS auto_set_tenant_id_unit_types();

-- =============================================
-- 7. Remove tenant_id column and update constraints
-- =============================================
ALTER TABLE unit_types DROP CONSTRAINT IF EXISTS unit_types_tenant_id_fkey;
DROP INDEX IF EXISTS idx_unit_types_tenant;
ALTER TABLE unit_types DROP CONSTRAINT IF EXISTS unit_types_code_tenant_id_key;
ALTER TABLE unit_types DROP COLUMN IF EXISTS tenant_id;

-- Add unique constraint on code only
ALTER TABLE unit_types ADD CONSTRAINT unit_types_code_key UNIQUE (code);

-- =============================================
-- 8. Create new RLS policy (read-only for all authenticated)
-- =============================================
CREATE POLICY "Authenticated users can view unit_types"
    ON unit_types FOR SELECT
    TO authenticated
    USING (true);

-- =============================================
-- 9. Clean up temp tables
-- =============================================
DROP TABLE IF EXISTS unit_type_mapping;
DROP TABLE IF EXISTS unit_types_to_keep;

-- =============================================
-- 10. Update table comment
-- =============================================
COMMENT ON TABLE unit_types IS 'Global units of measurement for inventory items (shared across all tenants)';
