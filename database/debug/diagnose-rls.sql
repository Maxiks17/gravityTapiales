-- =====================================================
-- DIAGNOSTICAR PROBLEMA DE RLS
-- =====================================================

-- 1. Ver qué tenant_id devuelve la función para el usuario actual
SELECT 
    auth.uid() as current_user_id,
    get_user_tenant_id() as current_tenant_id;

-- 2. Ver la relación del usuario actual con sus tenants
SELECT 
    ut.user_id,
    ut.tenant_id,
    t.name as tenant_name,
    ut.role,
    ut.is_active
FROM user_tenants ut
LEFT JOIN tenants t ON t.id = ut.tenant_id
WHERE ut.user_id = auth.uid();

-- 3. Ver si las policies existen en products
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
    AND tablename = 'products';

-- 4. Probar query directa - ¿Qué productos deberías ver?
SELECT 
    p.id,
    p.name,
    p.tenant_id,
    t.name as tenant_name,
    CASE 
        WHEN p.tenant_id = get_user_tenant_id() THEN 'DEBERIAS VER'
        ELSE 'NO DEBERIAS VER'
    END as deberia_ver
FROM products p
LEFT JOIN tenants t ON t.id = p.tenant_id;

-- 5. Ver todos los productos SIN aplicar RLS (usando bypassrls)
-- Esto requiere permisos de superusuario
SELECT 
    p.id,
    p.name,
    p.tenant_id,
    t.name as tenant_name
FROM products p
LEFT JOIN tenants t ON t.id = p.tenant_id
ORDER BY p.tenant_id, p.name;
