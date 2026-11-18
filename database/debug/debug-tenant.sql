-- =====================================================
-- SCRIPT DE VERIFICACIÓN DE MULTI-TENANCY
-- =====================================================
-- Ejecuta estas consultas en Supabase SQL Editor para verificar
-- que el sistema multi-tenant está funcionando correctamente

-- 1. Ver todos los tenants creados
SELECT 
    id,
    name,
    slug,
    email,
    is_active,
    settings,
    created_at
FROM tenants
ORDER BY created_at DESC;

-- 2. Ver relación usuarios-tenants
SELECT 
    ut.id,
    ut.user_id,
    u.email as user_email,
    ut.tenant_id,
    t.name as tenant_name,
    ut.role,
    ut.is_active,
    ut.created_at
FROM user_tenants ut
LEFT JOIN auth.users u ON u.id = ut.user_id
LEFT JOIN tenants t ON t.id = ut.tenant_id
ORDER BY ut.created_at DESC;

-- 3. Ver productos con su tenant
SELECT 
    p.id,
    p.name,
    p.tenant_id,
    t.name as tenant_name,
    p.created_at
FROM products p
LEFT JOIN tenants t ON t.id = p.tenant_id
ORDER BY p.created_at DESC
LIMIT 20;

-- 4. Verificar que el usuario actual tiene un tenant
SELECT get_user_tenant_id() as current_user_tenant_id;

-- 5. Ver productos que el usuario actual debería ver
-- (esto debería mostrar solo productos del tenant del usuario)
SELECT 
    p.id,
    p.name,
    p.tenant_id,
    t.name as tenant_name
FROM products p
LEFT JOIN tenants t ON t.id = p.tenant_id
WHERE p.tenant_id = get_user_tenant_id()
ORDER BY p.name;

-- 6. Verificar que las RLS policies están habilitadas
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('products', 'categories', 'customers', 'orders', 'tenants')
ORDER BY tablename;

-- 7. Ver las policies activas en la tabla products
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
    AND tablename = 'products';

-- 8. Verificar que el trigger handle_new_user existe
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'
    OR trigger_name LIKE '%handle_new_user%';
