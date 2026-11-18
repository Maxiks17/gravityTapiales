-- =====================================================
-- FIX: REGISTRATION PERMISSIONS & TRIGGER
-- =====================================================

-- 1. Ensure permissions are granted to necessary roles
-- This is often needed even with Security Definer if RLS is involved
GRANT ALL ON public.tenants TO postgres, service_role;
GRANT ALL ON public.user_tenants TO postgres, service_role;
GRANT ALL ON public.user_profiles TO postgres, service_role;

-- Allow authenticated users to insert (RLS will still apply, but basic permission is needed)
GRANT INSERT ON public.tenants TO authenticated, anon;
GRANT INSERT ON public.user_tenants TO authenticated, anon;
GRANT INSERT ON public.user_profiles TO authenticated, anon;

-- 2. Redefine the function with stricter settings and simpler logic
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
    
    -- Create profile
    INSERT INTO public.user_profiles (id, full_name, role)
    VALUES (NEW.id, v_user_name, 'admin')
    ON CONFLICT (id) DO NOTHING;
    
    -- Create user_tenant association
    INSERT INTO public.user_tenants (user_id, tenant_id, role, is_active)
    VALUES (NEW.id, v_tenant_id, 'admin', true);
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Re-raise the error so we see it in the client/logs
        -- But format it to be readable
        RAISE EXCEPTION 'Failed to create user resources: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 3. Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
