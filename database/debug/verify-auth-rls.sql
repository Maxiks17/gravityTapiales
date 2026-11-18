-- =====================================================
-- VERIFICAR AUTH Y RLS EN TIEMPO REAL
-- =====================================================

-- 1. Verificar que auth.uid() funciona correctamente
SELECT 
    auth.uid() as current_user_id,
    auth.jwt() as jwt_info;

-- 2. Ver si get_user_tenant_id() devuelve algo
SELECT get_user_tenant_id() as tenant_id_from_function;

-- 3. Ver user_tenants del usuario actual
SELECT 
    user_id,
    tenant_id,
    role,
    is_active
FROM user_tenants
WHERE user_id = auth.uid();

-- 4. IMPORTANTE: Ver si las policies están REALMENTE activas
-- Esto mostrará exactamente qué policies se aplican
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'products'
ORDER BY cmd;

-- 5. Probar SELECT directo en products - debería aplicar RLS
SELECT COUNT(*) as total_productos_que_veo FROM products;

-- 6. Ver productos con tenant_id
SELECT 
    id,
    name,
    tenant_id
FROM products
LIMIT 5;
