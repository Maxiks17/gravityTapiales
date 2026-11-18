-- =====================================================
-- BOOTSTRAP SQL (single-file)
-- Project ref (source): mrbdedmaaljdwkxdniqt
-- Generated from live database schema extraction
-- Date (local): 2025-12-23
--
-- Notes:
-- - Intended for a NEW/EMPTY Supabase database.
-- - Includes schema, functions, triggers, RLS policies, FKs, indexes and reference seed data.
-- - Supabase Auth settings (e.g. enabling hooks in Dashboard) are not fully expressible in SQL;
--   this script only creates the hook function & grants.
-- =====================================================

BEGIN;

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. FUNCIONES DE TRIGGER (no dependen de tablas)
-- =====================================================

-- Función genérica para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Función para actualizar updated_at en tables
CREATE OR REPLACE FUNCTION public.update_tables_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Función para actualizar updated_at en payment_methods  
CREATE OR REPLACE FUNCTION public.update_payment_methods_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- =====================================================
-- 2. TABLAS MAESTRAS (sin dependencias de tenant)
-- =====================================================

-- Tabla de tipos de tasas de IVA
CREATE TABLE IF NOT EXISTS public.tax_rate_types (
    id INTEGER PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
);

-- Tabla de condiciones fiscales (AFIP)
CREATE TABLE IF NOT EXISTS public.fiscal_condition (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    id_afip INTEGER,
    comp_clase VARCHAR(30)
);

-- Índice único para id_afip
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_condition_id_afip ON public.fiscal_condition USING btree (id_afip);

-- =====================================================
-- 3. TABLA DE TENANTS (Multi-tenant)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    subscription_status VARCHAR(20) DEFAULT 'active',
    subscription_plan VARCHAR(50) DEFAULT 'standard',
    billing_email VARCHAR(100),
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migración segura: Agrega las columnas si la tabla ya existe pero le faltan campos
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS email VARCHAR(100);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'active';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'standard';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_email VARCHAR(100);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Índices para tenants
CREATE INDEX IF NOT EXISTS idx_tenants_active ON public.tenants USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants USING btree (slug);

-- =====================================================
-- 4. TABLA DE RELACIÓN USUARIOS-TENANTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

-- Índices para user_tenants
CREATE INDEX IF NOT EXISTS idx_user_tenants_user ON public.user_tenants USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_id ON public.user_tenants USING btree (tenant_id);

-- =====================================================
-- 5. TABLA DE CATEGORÍAS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Índices para categories
CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON public.categories USING btree (tenant_id);

-- =====================================================
-- 6. TABLA DE SUBCATEGORÍAS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Índices para subcategories
CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON public.subcategories USING btree (category_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_tenant_id ON public.subcategories USING btree (tenant_id);

-- =====================================================
-- 7. TABLA DE MARCAS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Índices para brands
CREATE INDEX IF NOT EXISTS idx_brands_tenant_id ON public.brands USING btree (tenant_id);

-- =====================================================
-- 8. TABLA DE PRODUCTOS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(50),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
    brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
    cost_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    sale_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    min_stock_level INTEGER DEFAULT 0,
    unit_type VARCHAR(20) DEFAULT 'unit',
    units_per_package INTEGER DEFAULT 1,
    image_url TEXT,
    additional_images TEXT[],
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    tax_rate INTEGER REFERENCES public.tax_rate_types(id) ON DELETE RESTRICT
);

-- Índices para products
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products USING btree (brand_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products USING btree (category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products USING btree (sku);
CREATE INDEX IF NOT EXISTS idx_products_sku_text ON public.products USING gin (to_tsvector('spanish'::regconfig, (sku)::text));
CREATE INDEX IF NOT EXISTS idx_products_subcategory_id ON public.products USING btree (subcategory_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON public.products USING btree (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique_idx ON public.products USING btree (sku) WHERE (sku IS NOT NULL);

-- =====================================================
-- 9. TABLA DE CLIENTES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Argentina',
    document_type INTEGER,
    document_number VARCHAR(20),
    credit_limit NUMERIC(10, 2) DEFAULT 0,
    payment_terms INTEGER DEFAULT 0,
    discount_percentage NUMERIC(5, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    vat_condition VARCHAR(50) DEFAULT 'consumidor_final',
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    condicion_fiscal_id INTEGER DEFAULT 0 REFERENCES public.fiscal_condition(id) ON DELETE NO ACTION,
    CONSTRAINT customers_document_type_check CHECK (
        document_type IS NULL OR document_type IN (0, 80, 86, 87, 89, 90, 91, 92, 93, 94, 95, 96, 99)
    ),
    CONSTRAINT customers_document_number_digits_check CHECK (
        document_number IS NULL OR document_number ~ '^[0-9]{1,20}$'
    )
);

-- Índices para customers
CREATE INDEX IF NOT EXISTS idx_customers_active ON public.customers USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers USING btree (email);
CREATE INDEX IF NOT EXISTS idx_customers_name_text ON public.customers USING gin (to_tsvector('spanish'::regconfig, (business_name)::text));
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON public.customers USING btree (tenant_id);

-- =====================================================
-- 10. TABLA DE ÁREAS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    floor VARCHAR(50) DEFAULT 'Principal',
    parent_id UUID REFERENCES public.areas(id) ON DELETE CASCADE,
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    width INTEGER DEFAULT 2,
    height INTEGER DEFAULT 2
);

-- Índices para areas
CREATE INDEX IF NOT EXISTS idx_areas_parent_id ON public.areas USING btree (parent_id);
CREATE INDEX IF NOT EXISTS idx_areas_tenant_id ON public.areas USING btree (tenant_id);

-- =====================================================
-- 11. TABLA DE MESAS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
    name VARCHAR(50) NOT NULL,
    capacity INTEGER DEFAULT 4,
    status VARCHAR(20) DEFAULT 'available',
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para tables
CREATE INDEX IF NOT EXISTS idx_tables_area_id ON public.tables USING btree (area_id);
CREATE INDEX IF NOT EXISTS idx_tables_tenant_id ON public.tables USING btree (tenant_id);

-- =====================================================
-- 12. TABLA DE MÉTODOS DE PAGO
-- =====================================================

CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    auto_invoice BOOLEAN NOT NULL DEFAULT false, -- true for digital payments (auto invoice), false for manual (cash)
    is_active BOOLEAN NOT NULL DEFAULT true,
    icon VARCHAR(50), -- lucide icon name (e.g., 'Banknote', 'CreditCard', 'Smartphone')
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- Índices para payment_methods
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON public.payment_methods USING btree (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON public.payment_methods USING btree (tenant_id);

-- =====================================================
-- 13. TABLA DE PEDIDOS (Orders)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivery_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending',
    subtotal NUMERIC(10, 2) DEFAULT 0,
    discount_amount NUMERIC(10, 2) DEFAULT 0,
    tax_amount NUMERIC(10, 2) DEFAULT 0,
    total_amount NUMERIC(10, 2) DEFAULT 0,
    notes TEXT,
    delivery_address TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
    order_mode VARCHAR(50) DEFAULT 'mostrador',
    payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL
);

-- Índices para orders
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON public.orders USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders USING btree (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders USING btree (order_date);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON public.orders USING btree (payment_method_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders USING btree (status);
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON public.orders USING btree (table_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON public.orders USING btree (tenant_id);

-- =====================================================
-- 14. TABLA DE ITEMS DE PEDIDO
-- =====================================================

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL,
    discount_percentage NUMERIC(5, 2) DEFAULT 0,
    tax_rate NUMERIC(5, 2) DEFAULT 0,
    subtotal NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items USING btree (product_id);

-- =====================================================
-- 15. TABLA DE DOCUMENTOS FISCALES
-- =====================================================

create table public.fiscal_documents (
  id uuid not null default gen_random_uuid (),
  fdoc_number character varying(50) not null,
  order_id uuid null,
  customer_id uuid not null,
  fdoc_date timestamp with time zone null default now(),
  due_date timestamp with time zone null,
  paid_date timestamp with time zone null,
  status character varying(20) null default 'pending'::character varying,
  subtotal numeric(10, 2) null default 0,
  discount_amount numeric(10, 2) null default 0,
  tax_amount numeric(10, 2) null default 0,
  total_amount numeric(10, 2) null default 0,
  paid_amount numeric(10, 2) null default 0,
  notes text null,
  payment_method character varying(50) null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  tenant_id uuid null,
  constraint fiscal_documents_pkey primary key (id),
  constraint fiscal_documents_fdoc_number_key unique (fdoc_number),
  constraint fiscal_documents_customer_id_fkey foreign KEY (customer_id) references customers (id) on delete RESTRICT,
  constraint fiscal_documents_order_id_fkey foreign KEY (order_id) references orders (id) on delete set null,
  constraint fiscal_documents_tenant_id_fkey foreign KEY (tenant_id) references tenants (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_fiscal_documents_status on public.fiscal_documents using btree (status) TABLESPACE pg_default;

create index IF not exists idx_fiscal_documents_fdoc_date on public.fiscal_documents using btree (fdoc_date) TABLESPACE pg_default;

create index IF not exists idx_fiscal_documents_order_id on public.fiscal_documents using btree (order_id) TABLESPACE pg_default;

-- =====================================================
-- 16. TABLA DE CIERRES DE CAJA
-- =====================================================

CREATE TABLE IF NOT EXISTS public.cash_register_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    closure_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    order_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Índices para cash_register_closures
CREATE INDEX IF NOT EXISTS idx_cash_closures_date_desc ON public.cash_register_closures USING btree (tenant_id, closure_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_register_closures_date ON public.cash_register_closures USING btree (closure_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_register_closures_user_id ON public.cash_register_closures USING btree (user_id);

-- =====================================================
-- 17. FUNCIONES QUE DEPENDEN DE TABLAS
-- =====================================================

-- Función para obtener el tenant_id del usuario actual
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tenant_id 
  FROM public.user_tenants
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- Función para verificar si el usuario es admin del tenant
CREATE OR REPLACE FUNCTION public.is_tenant_admin(check_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_tenants
    WHERE user_id = auth.uid()
      AND tenant_id = check_tenant_id
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- Función para auto-asignar tenant_id
CREATE OR REPLACE FUNCTION public.auto_set_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id := get_user_tenant_id();
    END IF;
    RETURN NEW;
END;
$$;

-- Función específica para auto-asignar tenant_id en payment_methods
CREATE OR REPLACE FUNCTION public.auto_set_tenant_id_payment_methods()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO NEW.tenant_id
        FROM user_tenants
        WHERE user_id = auth.uid()
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$;

-- Función para manejar creación de nuevos usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

    -- Associate user with their new tenant as admin
    INSERT INTO public.user_tenants (user_id, tenant_id, role, is_active)
    VALUES (NEW.id, v_tenant_id, 'admin', true);

    RETURN NEW;
END;
$$;

-- Hook para agregar claims personalizados al JWT (tenant_id)
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
declare
    claims jsonb;
    v_tenant_id uuid;
begin
    select ut.tenant_id
    into v_tenant_id
    from public.user_tenants ut
    where ut.user_id = (event->>'user_id')::uuid;

    claims := event->'claims';

    if v_tenant_id is not null then
        claims := jsonb_set(claims, '{"tenant_id"}', to_jsonb(v_tenant_id));
    else
        claims := claims;
    end if;

    event := jsonb_set(event, '{claims}', claims);
    return event;
end;
$$;

-- =====================================================
-- 18. TRIGGERS
-- =====================================================

-- Triggers para areas
DROP TRIGGER IF EXISTS areas_updated_at ON public.areas;
CREATE TRIGGER areas_updated_at 
    BEFORE UPDATE ON public.areas 
    FOR EACH ROW EXECUTE FUNCTION update_tables_updated_at();

DROP TRIGGER IF EXISTS set_tenant_id_areas ON public.areas;
CREATE TRIGGER set_tenant_id_areas 
    BEFORE INSERT ON public.areas 
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

-- Triggers para brands
DROP TRIGGER IF EXISTS update_brands_updated_at ON public.brands;
CREATE TRIGGER update_brands_updated_at 
    BEFORE UPDATE ON public.brands 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_tenant_id_brands ON public.brands;
CREATE TRIGGER set_tenant_id_brands 
    BEFORE INSERT ON public.brands 
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

-- Triggers para cash_register_closures
DROP TRIGGER IF EXISTS set_tenant_id_cash_register_closures ON public.cash_register_closures;
CREATE TRIGGER set_tenant_id_cash_register_closures 
    BEFORE INSERT ON public.cash_register_closures 
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

-- Triggers para categories
DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at 
    BEFORE UPDATE ON public.categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_tenant_id_categories ON public.categories;
CREATE TRIGGER set_tenant_id_categories 
    BEFORE INSERT ON public.categories 
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

-- Triggers para customers
DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON public.customers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_tenant_id_customers ON public.customers;
CREATE TRIGGER set_tenant_id_customers 
    BEFORE INSERT ON public.customers 
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

-- Triggers para fiscal_documents
DROP TRIGGER IF EXISTS update_fiscal_documents_updated_at ON public.fiscal_documents;
CREATE TRIGGER update_fiscal_documents_updated_at 
    BEFORE UPDATE ON public.fiscal_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_tenant_id_fiscal_documents ON public.fiscal_documents;
CREATE TRIGGER set_tenant_id_fiscal_documents 
    BEFORE INSERT ON public.fiscal_documents 
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

-- Triggers para order_items
DROP TRIGGER IF EXISTS update_order_items_updated_at ON public.order_items;
CREATE TRIGGER update_order_items_updated_at 
    BEFORE UPDATE ON public.order_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers para orders
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON public.orders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_tenant_id_orders ON public.orders;
CREATE TRIGGER set_tenant_id_orders 
    BEFORE INSERT ON public.orders 
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

-- Triggers para payment_methods
DROP TRIGGER IF EXISTS payment_methods_updated_at ON public.payment_methods;
CREATE TRIGGER payment_methods_updated_at 
    BEFORE UPDATE ON public.payment_methods 
    FOR EACH ROW EXECUTE FUNCTION update_payment_methods_updated_at();

DROP TRIGGER IF EXISTS set_tenant_id_payment_methods ON public.payment_methods;
CREATE TRIGGER set_tenant_id_payment_methods 
    BEFORE INSERT ON public.payment_methods 
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id_payment_methods();

-- Triggers para products
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON public.products 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_tenant_id_products ON public.products;
CREATE TRIGGER set_tenant_id_products 
    BEFORE INSERT ON public.products 
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

-- Triggers para subcategories
DROP TRIGGER IF EXISTS update_subcategories_updated_at ON public.subcategories;
CREATE TRIGGER update_subcategories_updated_at 
    BEFORE UPDATE ON public.subcategories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_tenant_id_subcategories ON public.subcategories;
CREATE TRIGGER set_tenant_id_subcategories 
    BEFORE INSERT ON public.subcategories 
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

-- Triggers para tables
DROP TRIGGER IF EXISTS tables_updated_at ON public.tables;
CREATE TRIGGER tables_updated_at 
    BEFORE UPDATE ON public.tables 
    FOR EACH ROW EXECUTE FUNCTION update_tables_updated_at();

DROP TRIGGER IF EXISTS set_tenant_id_tables ON public.tables;
CREATE TRIGGER set_tenant_id_tables 
    BEFORE INSERT ON public.tables 
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id();

-- =====================================================
-- 19. HABILITAR RLS EN TODAS LAS TABLAS
-- =====================================================

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_register_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_condition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rate_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 20. POLÍTICAS RLS
-- =====================================================

-- ---- AREAS ----
DROP POLICY IF EXISTS areas_select_policy ON public.areas;
CREATE POLICY areas_select_policy ON public.areas
    FOR SELECT USING (
        tenant_id IN (
            SELECT user_tenants.tenant_id
            FROM user_tenants
            WHERE user_tenants.user_id = auth.uid() AND user_tenants.is_active = true
        )
    );

DROP POLICY IF EXISTS areas_insert_policy ON public.areas;
CREATE POLICY areas_insert_policy ON public.areas
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT user_tenants.tenant_id
            FROM user_tenants
            WHERE user_tenants.user_id = auth.uid() AND user_tenants.is_active = true
        )
    );

DROP POLICY IF EXISTS areas_update_policy ON public.areas;
CREATE POLICY areas_update_policy ON public.areas
    FOR UPDATE USING (
        tenant_id IN (
            SELECT user_tenants.tenant_id
            FROM user_tenants
            WHERE user_tenants.user_id = auth.uid() AND user_tenants.is_active = true
        )
    );

DROP POLICY IF EXISTS areas_delete_policy ON public.areas;
CREATE POLICY areas_delete_policy ON public.areas
    FOR DELETE USING (
        tenant_id IN (
            SELECT user_tenants.tenant_id
            FROM user_tenants
            WHERE user_tenants.user_id = auth.uid() AND user_tenants.is_active = true
        )
    );

-- ---- BRANDS ----
DROP POLICY IF EXISTS tenant_isolation_select ON public.brands;
CREATE POLICY tenant_isolation_select ON public.brands
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_insert ON public.brands;
CREATE POLICY tenant_isolation_insert ON public.brands
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_update ON public.brands;
CREATE POLICY tenant_isolation_update ON public.brands
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_delete ON public.brands;
CREATE POLICY tenant_isolation_delete ON public.brands
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- ---- CASH_REGISTER_CLOSURES ----
DROP POLICY IF EXISTS tenant_isolation_select ON public.cash_register_closures;
CREATE POLICY tenant_isolation_select ON public.cash_register_closures
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_insert ON public.cash_register_closures;
CREATE POLICY tenant_isolation_insert ON public.cash_register_closures
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_update ON public.cash_register_closures;
CREATE POLICY tenant_isolation_update ON public.cash_register_closures
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_delete ON public.cash_register_closures;
CREATE POLICY tenant_isolation_delete ON public.cash_register_closures
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- ---- CATEGORIES ----
DROP POLICY IF EXISTS tenant_isolation_select ON public.categories;
CREATE POLICY tenant_isolation_select ON public.categories
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_insert ON public.categories;
CREATE POLICY tenant_isolation_insert ON public.categories
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_update ON public.categories;
CREATE POLICY tenant_isolation_update ON public.categories
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_delete ON public.categories;
CREATE POLICY tenant_isolation_delete ON public.categories
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- ---- CUSTOMERS ----
DROP POLICY IF EXISTS tenant_isolation_select ON public.customers;
CREATE POLICY tenant_isolation_select ON public.customers
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_insert ON public.customers;
CREATE POLICY tenant_isolation_insert ON public.customers
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_update ON public.customers;
CREATE POLICY tenant_isolation_update ON public.customers
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_delete ON public.customers;
CREATE POLICY tenant_isolation_delete ON public.customers
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- ---- FISCAL_CONDITION (tabla maestra - acceso público lectura) ----
DROP POLICY IF EXISTS "Enable read access for all users" ON public.fiscal_condition;
CREATE POLICY "Enable read access for all users" ON public.fiscal_condition
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.fiscal_condition;
CREATE POLICY "Enable insert for authenticated users" ON public.fiscal_condition
    FOR INSERT WITH CHECK (auth.role() = 'authenticated'::text);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.fiscal_condition;
CREATE POLICY "Enable update for authenticated users" ON public.fiscal_condition
    FOR UPDATE USING (auth.role() = 'authenticated'::text);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.fiscal_condition;
CREATE POLICY "Enable delete for authenticated users" ON public.fiscal_condition
    FOR DELETE USING (auth.role() = 'authenticated'::text);

-- ---- FISCAL_DOCUMENTS ----
DROP POLICY IF EXISTS tenant_isolation_select ON public.fiscal_documents;
CREATE POLICY tenant_isolation_select ON public.fiscal_documents
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_insert ON public.fiscal_documents;
CREATE POLICY tenant_isolation_insert ON public.fiscal_documents
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_update ON public.fiscal_documents;
CREATE POLICY tenant_isolation_update ON public.fiscal_documents
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_delete ON public.fiscal_documents;
CREATE POLICY tenant_isolation_delete ON public.fiscal_documents
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- ---- ORDER_ITEMS (RLS a través de orders) ----
DROP POLICY IF EXISTS tenant_isolation_select ON public.order_items;
CREATE POLICY tenant_isolation_select ON public.order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id AND orders.tenant_id = get_user_tenant_id()
        )
    );

DROP POLICY IF EXISTS tenant_isolation_insert ON public.order_items;
CREATE POLICY tenant_isolation_insert ON public.order_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id AND orders.tenant_id = get_user_tenant_id()
        )
    );

DROP POLICY IF EXISTS tenant_isolation_update ON public.order_items;
CREATE POLICY tenant_isolation_update ON public.order_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id AND orders.tenant_id = get_user_tenant_id()
        )
    );

DROP POLICY IF EXISTS tenant_isolation_delete ON public.order_items;
CREATE POLICY tenant_isolation_delete ON public.order_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id AND orders.tenant_id = get_user_tenant_id()
        )
    );

-- ---- ORDERS ----
DROP POLICY IF EXISTS tenant_isolation_select ON public.orders;
CREATE POLICY tenant_isolation_select ON public.orders
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_insert ON public.orders;
CREATE POLICY tenant_isolation_insert ON public.orders
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_update ON public.orders;
CREATE POLICY tenant_isolation_update ON public.orders
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_delete ON public.orders;
CREATE POLICY tenant_isolation_delete ON public.orders
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- ---- PAYMENT_METHODS ----
DROP POLICY IF EXISTS "Users can view payment methods from their tenant" ON public.payment_methods;
CREATE POLICY "Users can view payment methods from their tenant" ON public.payment_methods
    FOR SELECT USING (
        tenant_id IN (
            SELECT user_tenants.tenant_id
            FROM user_tenants
            WHERE user_tenants.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert payment methods for their tenant" ON public.payment_methods;
CREATE POLICY "Users can insert payment methods for their tenant" ON public.payment_methods
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT user_tenants.tenant_id
            FROM user_tenants
            WHERE user_tenants.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update payment_methods from their tenant" ON public.payment_methods;
CREATE POLICY "Users can update payment_methods from their tenant" ON public.payment_methods
    FOR UPDATE USING (
        tenant_id IN (
            SELECT user_tenants.tenant_id
            FROM user_tenants
            WHERE user_tenants.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete payment methods from their tenant" ON public.payment_methods;
CREATE POLICY "Users can delete payment methods from their tenant" ON public.payment_methods
    FOR DELETE USING (
        tenant_id IN (
            SELECT user_tenants.tenant_id
            FROM user_tenants
            WHERE user_tenants.user_id = auth.uid()
        )
    );

-- ---- PRODUCTS ----
DROP POLICY IF EXISTS tenant_isolation_select ON public.products;
CREATE POLICY tenant_isolation_select ON public.products
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_insert ON public.products;
CREATE POLICY tenant_isolation_insert ON public.products
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_update ON public.products;
CREATE POLICY tenant_isolation_update ON public.products
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_delete ON public.products;
CREATE POLICY tenant_isolation_delete ON public.products
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- ---- SUBCATEGORIES ----
DROP POLICY IF EXISTS tenant_isolation_select ON public.subcategories;
CREATE POLICY tenant_isolation_select ON public.subcategories
    FOR SELECT USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_insert ON public.subcategories;
CREATE POLICY tenant_isolation_insert ON public.subcategories
    FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_update ON public.subcategories;
CREATE POLICY tenant_isolation_update ON public.subcategories
    FOR UPDATE USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_delete ON public.subcategories;
CREATE POLICY tenant_isolation_delete ON public.subcategories
    FOR DELETE USING (tenant_id = get_user_tenant_id());

-- ---- TABLES ----
DROP POLICY IF EXISTS tables_select_policy ON public.tables;
CREATE POLICY tables_select_policy ON public.tables
    FOR SELECT USING (
        tenant_id IN (
            SELECT user_tenants.tenant_id
            FROM user_tenants
            WHERE user_tenants.user_id = auth.uid() AND user_tenants.is_active = true
        )
    );

DROP POLICY IF EXISTS tables_insert_policy ON public.tables;
CREATE POLICY tables_insert_policy ON public.tables
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT user_tenants.tenant_id
            FROM user_tenants
            WHERE user_tenants.user_id = auth.uid() AND user_tenants.is_active = true
        )
    );

DROP POLICY IF EXISTS tables_update_policy ON public.tables;
CREATE POLICY tables_update_policy ON public.tables
    FOR UPDATE USING (
        tenant_id IN (
            SELECT user_tenants.tenant_id
            FROM user_tenants
            WHERE user_tenants.user_id = auth.uid() AND user_tenants.is_active = true
        )
    );

DROP POLICY IF EXISTS tables_delete_policy ON public.tables;
CREATE POLICY tables_delete_policy ON public.tables
    FOR DELETE USING (
        tenant_id IN (
            SELECT user_tenants.tenant_id
            FROM user_tenants
            WHERE user_tenants.user_id = auth.uid() AND user_tenants.is_active = true
        )
    );

-- ---- TAX_RATE_TYPES (tabla maestra - acceso público lectura) ----
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tax_rate_types;
CREATE POLICY "Enable read access for all users" ON public.tax_rate_types
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.tax_rate_types;
CREATE POLICY "Enable insert for authenticated users" ON public.tax_rate_types
    FOR INSERT WITH CHECK (auth.role() = 'authenticated'::text);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.tax_rate_types;
CREATE POLICY "Enable update for authenticated users" ON public.tax_rate_types
    FOR UPDATE USING (auth.role() = 'authenticated'::text);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.tax_rate_types;
CREATE POLICY "Enable delete for authenticated users" ON public.tax_rate_types
    FOR DELETE USING (auth.role() = 'authenticated'::text);

-- ---- TENANTS ----
DROP POLICY IF EXISTS "Tenant access policy" ON public.tenants;
CREATE POLICY "Tenant access policy" ON public.tenants
    FOR SELECT USING (
        id IN (
            SELECT user_tenants.tenant_id
            FROM user_tenants
            WHERE user_tenants.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM user_tenants
            WHERE user_tenants.user_id = auth.uid() AND user_tenants.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can insert tenants" ON public.tenants;
CREATE POLICY "Admins can insert tenants" ON public.tenants
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_tenants
            WHERE user_tenants.user_id = auth.uid() AND user_tenants.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can update tenants" ON public.tenants;
CREATE POLICY "Admins can update tenants" ON public.tenants
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_tenants
            WHERE user_tenants.user_id = auth.uid() AND user_tenants.role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Admins can delete tenants" ON public.tenants;
CREATE POLICY "Admins can delete tenants" ON public.tenants
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM user_tenants
            WHERE user_tenants.user_id = auth.uid() AND user_tenants.role = 'admin'
        )
    );

-- ---- USER_TENANTS ----
DROP POLICY IF EXISTS "Users can view tenant associations" ON public.user_tenants;
CREATE POLICY "Users can view tenant associations" ON public.user_tenants
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow auth admin to read user tenants" ON public.user_tenants;
CREATE POLICY "Allow auth admin to read user tenants" ON public.user_tenants
    AS PERMISSIVE FOR SELECT TO supabase_auth_admin USING (true);

DROP POLICY IF EXISTS "Admins can add users to tenants" ON public.user_tenants;
CREATE POLICY "Admins can add users to tenants" ON public.user_tenants
    FOR INSERT WITH CHECK (is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "Admins can update user tenants" ON public.user_tenants;
CREATE POLICY "Admins can update user tenants" ON public.user_tenants
    FOR UPDATE USING (is_tenant_admin(tenant_id)) WITH CHECK (is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "Admins can remove users from tenants" ON public.user_tenants;
CREATE POLICY "Admins can remove users from tenants" ON public.user_tenants
    FOR DELETE USING (is_tenant_admin(tenant_id));

-- =====================================================
-- 21. TRIGGER PARA NUEVOS USUARIOS (auth.users)
-- =====================================================

-- Crear el trigger en auth.users para crear tenant automáticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 22. GRANTS PARA EL HOOK DE JWT
-- =====================================================

-- Permisos necesarios para que el hook de JWT funcione
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
GRANT ALL ON TABLE public.user_tenants TO supabase_auth_admin;

-- =====================================================
-- 23. DATOS SEMILLA (Seed Data)
-- =====================================================

-- Tipos de tasas de IVA
INSERT INTO public.tax_rate_types (id, nombre) VALUES
    (3, '0%'),
    (4, '10.5%'),
    (5, '21%'),
    (6, '27%')
ON CONFLICT (id) DO NOTHING;

-- Condiciones fiscales de AFIP
INSERT INTO public.fiscal_condition (id, name, id_afip, comp_clase) VALUES
    (0, 'Sin especificar', 0, ''),
    (1, 'IVA Responsable Inscripto', 1, 'A/ALEY/C'),
    (4, 'IVA Sujeto Exento', 4, 'B/C'),
    (5, 'Consumidor Final', 5, 'C/49'),
    (6, 'Responsable Monotributo', 6, 'A/ALEY/C'),
    (7, 'Sujeto No Categorizado', 7, 'B/C'),
    (8, 'Proveedor del Exterior', 8, 'B/C'),
    (9, 'Cliente del Exterior', 9, 'B/C'),
    (10, 'IVA Liberado – Ley N° 19.640', 10, ''),
    (13, 'Monotributista Social', 13, 'A/ALEY/C'),
    (15, 'IVA No Alcanzado', 15, 'B/C'),
    (16, 'Monotributo Trabajador Independiente Promovido', 16, 'A/ALEY/C')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- =====================================================
-- NOTAS IMPORTANTES POST-INSTALACIÓN
-- =====================================================
-- 
-- 1. HOOK DE JWT: Después de ejecutar este script, debes habilitar el hook
--    de autenticación en el Dashboard de Supabase:
--    - Ve a Authentication > Hooks
--    - Habilita "Custom Access Token Hook"
--    - Selecciona la función: public.custom_access_token_hook
--
-- 2. Este script está diseñado para ser ejecutado en una base de datos VACÍA.
--    Si la base ya tiene datos, pueden ocurrir conflictos.
--
-- 3. Las políticas RLS aseguran que cada tenant solo vea sus propios datos.
--
-- =====================================================
