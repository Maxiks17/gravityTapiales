-- =====================================================
-- FIX: Areas RLS Error
-- =====================================================
-- The 'areas' table was missing the trigger to automatically populate 
-- the tenant_id from the current user's session.
-- This caused RLS policies to fail on INSERT because tenant_id was NULL.
-- =====================================================

-- 1. Create trigger for areas table to auto-set tenant_id
-- Uses existing function auto_set_tenant_id() defined in enable-multi-tenant.sql

DROP TRIGGER IF EXISTS set_tenant_id_areas ON areas;
CREATE TRIGGER set_tenant_id_areas BEFORE INSERT ON areas
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

-- 2. Verify RLS (Safety Check)
-- Ensures the table has RLS enabled
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
