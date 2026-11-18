-- =====================================================
-- SCHEMA SQL PARA APLICACIÓN DE DISTRIBUCIÓN DE ALIMENTOS
-- =====================================================
-- Este script crea todas las tablas necesarias para la aplicación
-- Ejecutar en Supabase SQL Editor

-- =====================================================
-- 1. TABLA DE CATEGORÍAS
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. TABLA DE SUBCATEGORÍAS
-- =====================================================
CREATE TABLE IF NOT EXISTS subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. TABLA DE MARCAS
-- =====================================================
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. TABLA DE DISTRIBUIDORES/PROVEEDORES
-- =====================================================
CREATE TABLE IF NOT EXISTS distributors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Argentina',
    tax_id VARCHAR(50), -- CUIT/CUIL
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. TABLA DE PRODUCTOS
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    subcategory_id UUID REFERENCES subcategories(id) ON DELETE SET NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    distributor_id UUID REFERENCES distributors(id) ON DELETE SET NULL,
    
    -- Precios
    cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    sale_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    -- Inventario
    stock_quantity INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 0,
    
    -- Unidades
    unit_type VARCHAR(20) DEFAULT 'unit', -- unit, kg, liter, box, etc.
    units_per_package INTEGER DEFAULT 1,
    
    -- Imágenes
    image_url TEXT,
    additional_images TEXT[], -- Array de URLs
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. TABLA DE CLIENTES
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Información básica
    business_name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    
    -- Dirección
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Argentina',
    
    -- Información fiscal
    document_type INTEGER,
    document_number VARCHAR(20),
    
    -- Configuración comercial
    credit_limit DECIMAL(10, 2) DEFAULT 0,
    payment_terms INTEGER DEFAULT 0, -- Días de crédito
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT customers_document_type_check CHECK (
        document_type IS NULL OR document_type IN (0, 80, 86, 87, 89, 90, 91, 92, 93, 94, 95, 96, 99)
    ),
    CONSTRAINT customers_document_number_digits_check CHECK (
        document_number IS NULL OR document_number ~ '^[0-9]{1,20}$'
    )
);

-- =====================================================
-- 7. TABLA DE PEDIDOS
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    
    -- Fechas
    order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivery_date TIMESTAMP WITH TIME ZONE,
    
    -- Estado del pedido
    status VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, preparing, shipped, delivered, cancelled
    
    -- Totales
    subtotal DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) DEFAULT 0,
    
    -- Información adicional
    notes TEXT,
    delivery_address TEXT,
    
    -- Usuario que creó el pedido
    created_by UUID REFERENCES auth.users(id),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. TABLA DE ITEMS DE PEDIDO
-- =====================================================
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    
    -- Cantidad y precios
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    discount_percentage DECIMAL(5, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    subtotal DECIMAL(10, 2) NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 9. TABLA DE FACTURAS
-- =====================================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    
    -- Fechas
    invoice_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date TIMESTAMP WITH TIME ZONE,
    paid_date TIMESTAMP WITH TIME ZONE,
    
    -- Estado
    status VARCHAR(20) DEFAULT 'pending', -- pending, paid, overdue, cancelled
    
    -- Totales
    subtotal DECIMAL(10, 2) DEFAULT 0,
    discount_amount DECIMAL(10, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) DEFAULT 0,
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    
    -- Información adicional
    notes TEXT,
    payment_method VARCHAR(50), -- cash, transfer, check, card
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 10. TABLA DE PERFILES DE USUARIO (extiende auth.users)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Información personal
    full_name VARCHAR(100),
    phone VARCHAR(20),
    avatar_url TEXT,
    
    -- Rol y permisos
    role VARCHAR(20) DEFAULT 'user', -- admin, manager, sales, user
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 11. TABLA DE CONFIGURACIÓN DEL SISTEMA
-- =====================================================
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- =====================================================

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);

CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- =====================================================
-- FUNCIONES PARA ACTUALIZAR updated_at AUTOMÁTICAMENTE
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- Aplicar trigger a todas las tablas
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subcategories_updated_at BEFORE UPDATE ON subcategories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_distributors_updated_at BEFORE UPDATE ON distributors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) - POLÍTICAS BÁSICAS
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (permitir lectura a usuarios autenticados)
-- NOTA: Ajusta estas políticas según tus necesidades de seguridad

-- Categorías - Lectura pública, escritura solo autenticados
CREATE POLICY "Categories are viewable by everyone" ON categories
    FOR SELECT USING (true);

CREATE POLICY "Categories are editable by authenticated users" ON categories
    FOR ALL USING (auth.role() = 'authenticated');

-- Productos - Lectura pública, escritura solo autenticados
CREATE POLICY "Products are viewable by everyone" ON products
    FOR SELECT USING (true);

CREATE POLICY "Products are editable by authenticated users" ON products
    FOR ALL USING (auth.role() = 'authenticated');

-- Clientes - Solo usuarios autenticados
CREATE POLICY "Customers are viewable by authenticated users" ON customers
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Customers are editable by authenticated users" ON customers
    FOR ALL USING (auth.role() = 'authenticated');

-- Pedidos - Solo usuarios autenticados
CREATE POLICY "Orders are viewable by authenticated users" ON orders
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Orders are editable by authenticated users" ON orders
    FOR ALL USING (auth.role() = 'authenticated');

-- Items de pedido - Solo usuarios autenticados
CREATE POLICY "Order items are viewable by authenticated users" ON order_items
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Order items are editable by authenticated users" ON order_items
    FOR ALL USING (auth.role() = 'authenticated');

-- Facturas - Solo usuarios autenticados
CREATE POLICY "Invoices are viewable by authenticated users" ON invoices
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Invoices are editable by authenticated users" ON invoices
    FOR ALL USING (auth.role() = 'authenticated');

-- Perfiles de usuario - Los usuarios pueden ver y editar su propio perfil
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- =====================================================
-- DATOS DE EJEMPLO (OPCIONAL)
-- =====================================================

-- Insertar algunas categorías de ejemplo
INSERT INTO categories (name, description) VALUES
    ('Lácteos', 'Productos lácteos y derivados'),
    ('Carnes', 'Carnes rojas, blancas y embutidos'),
    ('Frutas y Verduras', 'Productos frescos'),
    ('Bebidas', 'Bebidas alcohólicas y no alcohólicas'),
    ('Panadería', 'Pan, facturas y productos de panadería')
ON CONFLICT DO NOTHING;

-- Insertar configuraciones del sistema
INSERT INTO system_settings (key, value, description) VALUES
    ('company_name', 'Mi Distribuidora', 'Nombre de la empresa'),
    ('tax_rate', '21', 'Tasa de IVA en porcentaje'),
    ('currency', 'ARS', 'Moneda del sistema'),
    ('default_payment_terms', '30', 'Días de crédito por defecto')
ON CONFLICT DO NOTHING;

-- =====================================================
-- FUNCIÓN PARA CREAR PERFIL DE USUARIO AUTOMÁTICAMENTE
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, role)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'user');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil automáticamente cuando se registra un usuario
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- SCRIPT COMPLETADO
-- =====================================================
-- Para ejecutar este script:
-- 1. Ve a tu proyecto de Supabase
-- 2. Abre el SQL Editor
-- 3. Copia y pega todo este contenido
-- 4. Haz clic en "Run" para ejecutar
-- =====================================================
