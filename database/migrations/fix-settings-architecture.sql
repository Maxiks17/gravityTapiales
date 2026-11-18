-- =====================================================
-- MIGRATION: FIX SETTINGS ARCHITECTURE
-- =====================================================
-- This script consolidates settings into the 'settings' table
-- and drops the legacy 'system_settings' table.
-- =====================================================

DO $$
DECLARE
    v_default_tenant_id UUID;
BEGIN
    -- 1. Get default tenant ID
    SELECT id INTO v_default_tenant_id FROM tenants WHERE slug = 'default' LIMIT 1;
    
    -- If no default tenant, try to get the first active tenant
    IF v_default_tenant_id IS NULL THEN
        SELECT id INTO v_default_tenant_id FROM tenants WHERE is_active = true LIMIT 1;
    END IF;

    -- If still null, we can't migrate data safely, so we skip data migration
    -- (This shouldn't happen in a properly initialized system)
    IF v_default_tenant_id IS NOT NULL THEN
        
        -- 2. Migrate data from system_settings to settings
        -- Only insert keys that don't already exist in settings for this tenant
        INSERT INTO settings (tenant_id, key, value, description, created_at, updated_at)
        SELECT 
            v_default_tenant_id,
            s.key,
            s.value,
            s.description,
            COALESCE(s.updated_at, NOW()), -- Use updated_at as created_at approximation
            COALESCE(s.updated_at, NOW())
        FROM system_settings s
        WHERE NOT EXISTS (
            SELECT 1 FROM settings st 
            WHERE st.tenant_id = v_default_tenant_id 
            AND st.key = s.key
        );
        
        RAISE NOTICE 'Migrated system_settings to settings for tenant %', v_default_tenant_id;
    END IF;
END $$;

-- 3. Ensure 'settings' table has correct structure and constraints

-- Add tenant_id if missing (should exist from previous migration, but being safe)
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Drop old unique constraint on key if exists
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;

-- Create unique index on (tenant_id, key)
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_tenant_key ON settings(tenant_id, key);

-- 4. Enable RLS and Policies
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view settings" ON settings;
DROP POLICY IF EXISTS "Users can update settings" ON settings;
DROP POLICY IF EXISTS "Users can insert settings" ON settings;
DROP POLICY IF EXISTS "tenant_isolation_select" ON settings;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON settings;
DROP POLICY IF EXISTS "tenant_isolation_update" ON settings;
DROP POLICY IF EXISTS "tenant_isolation_delete" ON settings;

-- Create new policies
CREATE POLICY "tenant_isolation_select" ON settings
    FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_insert" ON settings
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_update" ON settings
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_delete" ON settings
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- 5. Drop legacy table
DROP TABLE IF EXISTS system_settings;
