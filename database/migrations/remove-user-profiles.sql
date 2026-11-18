-- Migration to remove user_profiles table
-- This script removes the user_profiles table and updates related functions
-- Safe to run even if table doesn't exist

-- Step 1: Update handle_new_user function to remove user_profiles references
-- This function is called when a new user registers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER -- Run as the creator of the function (admin)
SET search_path = public -- Prevent search_path hijacking
AS $$
DECLARE
    v_tenant_id UUID;
    v_tenant_name TEXT;
    v_tenant_slug TEXT;
    v_user_name TEXT;
BEGIN
    -- Get user name or default
    v_user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario');

    -- Generate simple unique slug using UUID to avoid type casting issues
    v_tenant_name := 'Distribuidora ' || v_user_name;
    v_tenant_slug := 'dist-' || SUBSTRING(gen_random_uuid()::text from 1 for 18);

    -- Create tenant
    INSERT INTO public.tenants (name, slug, is_active, settings)
    VALUES (
        v_tenant_name,
        v_tenant_slug,
        true,
        '{"is_setup_complete": false}'::jsonb
    )
    RETURNING id INTO v_tenant_id;

    -- Associate user with their new tenant as admin
    -- user_tenants is the only table needed for user-tenant relationships
    INSERT INTO public.user_tenants (user_id, tenant_id, role, is_active)
    VALUES (NEW.id, v_tenant_id, 'admin', true);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Drop RLS policies that reference user_profiles
-- Check for policies that use user_profiles in their definition
DROP POLICY IF EXISTS "Admins can manage tenants" ON tenants;

-- Recreate the policy without user_profiles
-- Now use user_tenants to check for admin role
CREATE POLICY "Admins can manage tenants" ON tenants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_tenants
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Step 3: Drop the trigger that updates user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

-- Step 4: Drop the table
-- Using CASCADE to automatically drop dependent objects (policies, constraints, etc.)
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Note: All user role management is now handled via user_tenants table
-- The user_tenants table provides per-tenant role management which is more appropriate
-- for a multi-tenant system than a global role in user_profiles
