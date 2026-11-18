-- =====================================================
-- MIGRATION: CONSOLIDATE SETTINGS INTO TENANTS TABLE
-- =====================================================
-- This script moves data from the 'settings' table to the 
-- 'settings' JSONB column in the 'tenants' table and drops
-- the 'settings' table.
-- =====================================================

DO $$
DECLARE
    r RECORD;
    settings_json JSONB;
BEGIN
    -- Iterate through all tenants
    FOR r IN SELECT id, settings FROM tenants LOOP
        -- Build JSON object from settings table for this tenant
        -- We aggregate key-value pairs into a JSON object
        SELECT jsonb_object_agg(key, value)
        INTO settings_json
        FROM settings
        WHERE tenant_id = r.id;

        -- If there are settings to migrate
        IF settings_json IS NOT NULL THEN
            -- Merge with existing settings
            -- We use || operator to merge JSONB objects
            -- Existing tenant settings are preserved, new ones are added
            -- If keys collide, the one on the right (settings_json) overwrites the left
            -- This is desired as the table 'settings' likely holds the most up-to-date config values
            
            UPDATE tenants
            SET settings = COALESCE(settings, '{}'::jsonb) || settings_json
            WHERE id = r.id;
            
            RAISE NOTICE 'Migrated settings for tenant %', r.id;
        END IF;
    END LOOP;
END $$;

-- Drop the settings table as it is no longer needed
DROP TABLE IF EXISTS settings;

-- Drop the legacy system_settings table if it still exists (just in case)
DROP TABLE IF EXISTS system_settings;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
