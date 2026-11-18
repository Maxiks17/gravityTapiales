-- =====================================================
-- ASIGNAR TENANT AL SEGUNDO USUARIO
-- =====================================================

-- Paso 1: Ver los usuarios que NO tienen tenant asignado
SELECT 
    u.id,
    u.email,
    u.created_at,
    CASE 
        WHEN ut.user_id IS NULL THEN 'SIN TENANT'
        ELSE 'TIENE TENANT'
    END as estado
FROM auth.users u
LEFT JOIN user_tenants ut ON ut.user_id = u.id
ORDER BY u.created_at;

-- Paso 2: Crear tenant para TODOS los usuarios que no tengan uno
DO $$
DECLARE
    v_user record;
    v_tenant_id UUID;
    v_tenant_name TEXT;
    v_tenant_slug TEXT;
BEGIN
    -- Para cada usuario sin tenant
    FOR v_user IN 
        SELECT u.id, u.email
        FROM auth.users u
        LEFT JOIN user_tenants ut ON ut.user_id = u.id
        WHERE ut.user_id IS NULL
    LOOP
        -- Crear tenant para este usuario
        v_tenant_name := 'Distribuidora ' || SUBSTRING(v_user.id::TEXT FROM 1 FOR 8);
        v_tenant_slug := 'dist-' || SUBSTRING(v_user.id::TEXT FROM 1 FOR 8);
        
        INSERT INTO tenants (name, slug, is_active, settings)
        VALUES (
            v_tenant_name,
            v_tenant_slug,
            true,
            '{"is_setup_complete": false}'::jsonb
        )
        RETURNING id INTO v_tenant_id;
        
        -- Crear user_profile si no existe
        INSERT INTO public.user_profiles (id, role)
        VALUES (v_user.id, 'admin')
        ON CONFLICT (id) DO NOTHING;
        
        -- Asignar usuario al tenant
        INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
        VALUES (v_user.id, v_tenant_id, 'admin', true);
        
        RAISE NOTICE 'Tenant creado para usuario %: % (ID: %)', v_user.email, v_tenant_name, v_tenant_id;
    END LOOP;
END $$;

-- Paso 3: Verificar que ahora todos los usuarios tienen tenant
SELECT 
    u.id,
    u.email,
    t.name as tenant_name,
    ut.role
FROM auth.users u
LEFT JOIN user_tenants ut ON ut.user_id = u.id
LEFT JOIN tenants t ON t.id = ut.tenant_id
ORDER BY u.created_at;

-- Paso 4: Ver todos los tenants creados
SELECT 
    id,
    name,
    slug,
    settings,
    created_at
FROM tenants
ORDER BY created_at;
