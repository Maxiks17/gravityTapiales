-- =====================================================
-- HABILITAR ROW LEVEL SECURITY EN TODAS LAS TABLAS
-- =====================================================

-- Habilitar RLS en todas las tablas de datos
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_register_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Verificar que RLS está habilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'categories', 'subcategories', 'brands', 'distributors', 
        'products', 'customers', 'orders', 'order_items',
        'invoices', 'purchase_orders', 'purchase_order_items',
        'product_distributors', 'price_lists', 'cash_register_closures',
        'settings', 'tenants', 'user_tenants'
    )
ORDER BY tablename;

-- Ver cuántos registros tiene cada tabla por tenant
SELECT 
    'categories' as tabla,
    tenant_id,
    t.name as tenant_name,
    COUNT(*) as cantidad
FROM categories c
LEFT JOIN tenants t ON t.id = c.tenant_id
GROUP BY tenant_id, t.name
UNION ALL
SELECT 
    'products' as tabla,
    tenant_id,
    t.name as tenant_name,
    COUNT(*) as cantidad
FROM products p
LEFT JOIN tenants t ON t.id = p.tenant_id
GROUP BY tenant_id, t.name
UNION ALL
SELECT 
    'customers' as tabla,
    tenant_id,
    t.name as tenant_name,
    COUNT(*) as cantidad
FROM customers c
LEFT JOIN tenants t ON t.id = c.tenant_id
GROUP BY tenant_id, t.name
UNION ALL
SELECT 
    'orders' as tabla,
    tenant_id,
    t.name as tenant_name,
    COUNT(*) as cantidad
FROM orders o
LEFT JOIN tenants t ON t.id = o.tenant_id
GROUP BY tenant_id, t.name
ORDER BY tabla, tenant_id;
