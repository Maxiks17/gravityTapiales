-- =====================================================
-- FIX: USER REGISTRATION TRIGGER
-- =====================================================
-- This script updates the handle_new_user function to ensure
-- tenants are created correctly and errors are not swallowed.
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_tenant_name TEXT;
    v_tenant_slug TEXT;
    v_user_name TEXT;
BEGIN
    -- Get user name or default to 'Usuario'
    v_user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario');

    -- Create a unique tenant name and slug for this user
    -- Using a timestamp component to ensure uniqueness
    v_tenant_name := 'Distribuidora ' || v_user_name;
    v_tenant_slug := 'dist-' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8) || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT;
    
    -- Create a new tenant (distributor) for this user
    INSERT INTO tenants (name, slug, is_active, settings)
    VALUES (
        v_tenant_name,
        v_tenant_slug,
        true,
        '{"is_setup_complete": false}'::jsonb
    )
    RETURNING id INTO v_tenant_id;
    
    -- Create user profile
    INSERT INTO public.user_profiles (id, full_name, role)
    VALUES (NEW.id, v_user_name, 'admin')
    ON CONFLICT (id) DO UPDATE 
    SET full_name = EXCLUDED.full_name; -- Update name if exists
    
    -- Associate user with their new tenant as admin
    INSERT INTO public.user_tenants (user_id, tenant_id, role, is_active)
    VALUES (NEW.id, v_tenant_id, 'admin', true);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
