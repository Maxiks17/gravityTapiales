-- =====================================================
-- FIX: Row Level Security Policies
-- =====================================================
-- Este script arregla las políticas RLS para permitir operaciones CRUD
-- Ejecuta este script en tu proyecto de Supabase

-- 1. Deshabilitar RLS temporalmente o actualizar políticas para distributors
DROP POLICY IF EXISTS "Distributors are viewable by everyone" ON distributors;
DROP POLICY IF EXISTS "Distributors are editable by authenticated users" ON distributors;

CREATE POLICY "Enable read access for all users" ON distributors
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON distributors
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON distributors
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON distributors
    FOR DELETE USING (auth.role() = 'authenticated');

-- 2. Aplicar las mismas políticas a otras tablas
-- BRANDS
DROP POLICY IF EXISTS "Brands are viewable by everyone" ON brands;
DROP POLICY IF EXISTS "Brands are editable by authenticated users" ON brands;

CREATE POLICY "Enable read access for all users" ON brands
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON brands
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON brands
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON brands
    FOR DELETE USING (auth.role() = 'authenticated');

-- CATEGORIES
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON categories;
DROP POLICY IF EXISTS "Categories are editable by authenticated users" ON categories;

CREATE POLICY "Enable read access for all users" ON categories
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON categories
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON categories
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON categories
    FOR DELETE USING (auth.role() = 'authenticated');

-- CUSTOMERS
DROP POLICY IF EXISTS "Customers are viewable by everyone" ON customers;
DROP POLICY IF EXISTS "Customers are editable by authenticated users" ON customers;

CREATE POLICY "Enable read access for all users" ON customers
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON customers
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON customers
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON customers
    FOR DELETE USING (auth.role() = 'authenticated');

-- PRODUCTS
DROP POLICY IF EXISTS "Products are viewable by everyone" ON products;
DROP POLICY IF EXISTS "Products are editable by authenticated users" ON products;

CREATE POLICY "Enable read access for all users" ON products
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON products
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON products
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON products
    FOR DELETE USING (auth.role() = 'authenticated');

-- ORDERS
DROP POLICY IF EXISTS "Orders are viewable by everyone" ON orders;
DROP POLICY IF EXISTS "Orders are editable by authenticated users" ON orders;

CREATE POLICY "Enable read access for all users" ON orders
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON orders
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON orders
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON orders
    FOR DELETE USING (auth.role() = 'authenticated');

-- INVOICES
DROP POLICY IF EXISTS "Invoices are viewable by everyone" ON invoices;
DROP POLICY IF EXISTS "Invoices are editable by authenticated users" ON invoices;

CREATE POLICY "Enable read access for all users" ON invoices
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON invoices
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON invoices
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON invoices
    FOR DELETE USING (auth.role() = 'authenticated');

-- SYSTEM_SETTINGS (apply only if the table still exists)
DO $$
DECLARE
    tbl_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'system_settings'
    ) INTO tbl_exists;

    IF tbl_exists THEN
        EXECUTE format('DROP POLICY IF EXISTS "Settings are viewable by everyone" ON public.%I;', 'system_settings');
        EXECUTE format('DROP POLICY IF EXISTS "Settings are editable by authenticated users" ON public.%I;', 'system_settings');

        EXECUTE format('CREATE POLICY "Enable read access for all users" ON public.%I FOR SELECT USING (true);', 'system_settings');
        EXECUTE format('CREATE POLICY "Enable insert for authenticated users" ON public.%I FOR INSERT WITH CHECK (auth.role() = ''authenticated'');', 'system_settings');
        EXECUTE format('CREATE POLICY "Enable update for authenticated users" ON public.%I FOR UPDATE USING (auth.role() = ''authenticated'');', 'system_settings');
        EXECUTE format('CREATE POLICY "Enable delete for authenticated users" ON public.%I FOR DELETE USING (auth.role() = ''authenticated'');', 'system_settings');
    END IF;
END $$ LANGUAGE plpgsql;
