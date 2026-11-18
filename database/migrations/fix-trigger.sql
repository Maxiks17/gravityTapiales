-- =====================================================
-- VERIFICAR Y REPARAR TRIGGER handle_new_user
-- =====================================================

-- 1. Primero, verificar si existe el trigger en auth.users
SELECT 
    trigger_name,
    event_object_schema,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'auth' 
    AND event_object_table = 'users';

-- 2. Si no existe, crearlo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 3. Verificar que la función handle_new_user existe
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name = 'handle_new_user';

-- 4. Si el usuario nuevo no tiene tenant, asignárselo manualmente
-- EJECUTA ESTO SOLO SI TU USUARIO NUEVO NO TIENE TENANT:

-- Primero, obtén tu user_id actual (reemplaza el email)
-- SELECT id FROM auth.users WHERE email = 'TU_EMAIL_AQUI';

-- Luego, verifica si tienes un tenant asignado
-- SELECT * FROM user_tenants WHERE user_id = 'TU_USER_ID_AQUI';

-- Si no tienes tenant, crea uno manualmente:
/*
DO $$
DECLARE
    v_user_id UUID := 'REEMPLAZA_CON_TU_USER_ID'; -- Pega tu user_id aquí
    v_tenant_id UUID;
    v_tenant_name TEXT;
    v_tenant_slug TEXT;
BEGIN
    -- Verificar si el usuario ya tiene un tenant
    IF EXISTS (SELECT 1 FROM user_tenants WHERE user_id = v_user_id) THEN
        RAISE NOTICE 'El usuario ya tiene un tenant asignado';
        RETURN;
    END IF;
    
    -- Crear tenant para este usuario
    v_tenant_name := 'Distribuidora ' || SUBSTRING(v_user_id::TEXT FROM 1 FOR 8);
    v_tenant_slug := 'dist-' || SUBSTRING(v_user_id::TEXT FROM 1 FOR 8);
    
    INSERT INTO tenants (name, slug, is_active, settings)
    VALUES (
        v_tenant_name,
        v_tenant_slug,
        true,
        '{"is_setup_complete": false}'::jsonb
    )
    RETURNING id INTO v_tenant_id;
    
    -- Asignar usuario al tenant
    INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
    VALUES (v_user_id, v_tenant_id, 'admin', true);
    
    RAISE NOTICE 'Tenant creado con ID: %', v_tenant_id;
END $$;
*/
