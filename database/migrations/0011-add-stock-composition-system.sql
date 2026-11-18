-- =============================================
-- Migration: Add Stock Composition System (Bill of Materials)
-- Description: Creates stocks, product_composition, stock_movements tables for BOM-based inventory
-- Author: System
-- Date: 2025-02-01
-- =============================================

-- =============================================
-- 1. Create unit_types table (GLOBAL - shared across all tenants)
-- =============================================
CREATE TABLE IF NOT EXISTS unit_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    allows_decimals BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. Create stocks table (Inventory items / Raw materials)
-- =============================================
CREATE TABLE IF NOT EXISTS stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    quantity NUMERIC(15, 4) NOT NULL DEFAULT 0,
    min_stock_level NUMERIC(15, 4) DEFAULT 0,
    unit_type_id UUID REFERENCES unit_types(id) ON DELETE SET NULL,
    cost_price NUMERIC(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stocks_tenant ON stocks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stocks_active ON stocks(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_stocks_low_stock ON stocks(tenant_id)
    WHERE is_active = true;

-- =============================================
-- 3. Create stock_movement_type enum
-- =============================================
DO $$ BEGIN
    CREATE TYPE stock_movement_type AS ENUM (
        'sale',
        'purchase',
        'adjustment',
        'transfer',
        'return',
        'waste',
        'initial'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- 4. Create stock_movements table (Audit trail)
-- =============================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE CASCADE,
    movement_type stock_movement_type NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL,
    quantity_before NUMERIC(15, 4) NOT NULL,
    quantity_after NUMERIC(15, 4) NOT NULL,
    reason TEXT,
    reference_id UUID,
    reference_type VARCHAR(50),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_stock ON stock_movements(stock_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_id, reference_type);

-- =============================================
-- 5. Modify products table for composition support
-- =============================================
ALTER TABLE products
ADD COLUMN IF NOT EXISTS product_type VARCHAR(20) DEFAULT 'simple';

ALTER TABLE products
ADD COLUMN IF NOT EXISTS linked_stock_id UUID REFERENCES stocks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_linked_stock ON products(linked_stock_id);

-- =============================================
-- 6. Create product_composition table (Bill of Materials)
-- =============================================
CREATE TABLE IF NOT EXISTS product_composition (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    stock_id UUID NOT NULL REFERENCES stocks(id) ON DELETE RESTRICT,
    factor NUMERIC(10, 4) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id, stock_id)
);

CREATE INDEX IF NOT EXISTS idx_product_composition_tenant ON product_composition(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_composition_product ON product_composition(product_id);
CREATE INDEX IF NOT EXISTS idx_product_composition_stock ON product_composition(stock_id);

-- =============================================
-- 7. Enable RLS on tables
-- =============================================
ALTER TABLE unit_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_composition ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 8. RLS Policy for unit_types (read-only for all authenticated users)
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view unit_types" ON unit_types;

CREATE POLICY "Authenticated users can view unit_types"
    ON unit_types FOR SELECT
    TO authenticated
    USING (true);

-- =============================================
-- 9. RLS Policies for stocks
-- =============================================
DROP POLICY IF EXISTS "Users can view stocks from their tenant" ON stocks;
DROP POLICY IF EXISTS "Users can insert stocks for their tenant" ON stocks;
DROP POLICY IF EXISTS "Users can update stocks from their tenant" ON stocks;
DROP POLICY IF EXISTS "Users can delete stocks from their tenant" ON stocks;

CREATE POLICY "Users can view stocks from their tenant"
    ON stocks FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert stocks for their tenant"
    ON stocks FOR INSERT
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users can update stocks from their tenant"
    ON stocks FOR UPDATE
    USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete stocks from their tenant"
    ON stocks FOR DELETE
    USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

-- =============================================
-- 10. RLS Policies for stock_movements
-- =============================================
DROP POLICY IF EXISTS "Users can view stock_movements from their tenant" ON stock_movements;
DROP POLICY IF EXISTS "Users can insert stock_movements for their tenant" ON stock_movements;

CREATE POLICY "Users can view stock_movements from their tenant"
    ON stock_movements FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert stock_movements for their tenant"
    ON stock_movements FOR INSERT
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

-- =============================================
-- 11. RLS Policies for product_composition
-- =============================================
DROP POLICY IF EXISTS "Users can view product_composition from their tenant" ON product_composition;
DROP POLICY IF EXISTS "Users can insert product_composition for their tenant" ON product_composition;
DROP POLICY IF EXISTS "Users can update product_composition from their tenant" ON product_composition;
DROP POLICY IF EXISTS "Users can delete product_composition from their tenant" ON product_composition;

CREATE POLICY "Users can view product_composition from their tenant"
    ON product_composition FOR SELECT
    USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert product_composition for their tenant"
    ON product_composition FOR INSERT
    WITH CHECK (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users can update product_composition from their tenant"
    ON product_composition FOR UPDATE
    USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete product_composition from their tenant"
    ON product_composition FOR DELETE
    USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

-- =============================================
-- 12. Auto-set tenant_id triggers (for tenant-scoped tables only)
-- =============================================
CREATE OR REPLACE FUNCTION auto_set_tenant_id_stocks()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO NEW.tenant_id
        FROM user_tenants WHERE user_id = auth.uid() LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS set_tenant_id_stocks ON stocks;
CREATE TRIGGER set_tenant_id_stocks
    BEFORE INSERT ON stocks
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id_stocks();

CREATE OR REPLACE FUNCTION auto_set_tenant_id_stock_movements()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO NEW.tenant_id
        FROM user_tenants WHERE user_id = auth.uid() LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS set_tenant_id_stock_movements ON stock_movements;
CREATE TRIGGER set_tenant_id_stock_movements
    BEFORE INSERT ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id_stock_movements();

CREATE OR REPLACE FUNCTION auto_set_tenant_id_product_composition()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO NEW.tenant_id
        FROM user_tenants WHERE user_id = auth.uid() LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS set_tenant_id_product_composition ON product_composition;
CREATE TRIGGER set_tenant_id_product_composition
    BEFORE INSERT ON product_composition
    FOR EACH ROW EXECUTE FUNCTION auto_set_tenant_id_product_composition();

-- =============================================
-- 13. Updated_at triggers
-- =============================================
CREATE OR REPLACE FUNCTION update_unit_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS unit_types_updated_at ON unit_types;
CREATE TRIGGER unit_types_updated_at
    BEFORE UPDATE ON unit_types
    FOR EACH ROW EXECUTE FUNCTION update_unit_types_updated_at();

CREATE OR REPLACE FUNCTION update_stocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS stocks_updated_at ON stocks;
CREATE TRIGGER stocks_updated_at
    BEFORE UPDATE ON stocks
    FOR EACH ROW EXECUTE FUNCTION update_stocks_updated_at();

CREATE OR REPLACE FUNCTION update_product_composition_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS product_composition_updated_at ON product_composition;
CREATE TRIGGER product_composition_updated_at
    BEFORE UPDATE ON product_composition
    FOR EACH ROW EXECUTE FUNCTION update_product_composition_updated_at();

-- =============================================
-- 14. Function: Adjust stock with audit trail
-- =============================================
CREATE OR REPLACE FUNCTION adjust_stock(
    p_stock_id UUID,
    p_new_quantity NUMERIC,
    p_reason TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS stock_movements AS $$
DECLARE
    v_current_quantity NUMERIC;
    v_tenant_id UUID;
    v_movement stock_movements%ROWTYPE;
    v_quantity_change NUMERIC;
BEGIN
    SELECT quantity, tenant_id INTO v_current_quantity, v_tenant_id
    FROM stocks WHERE id = p_stock_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Stock not found: %', p_stock_id;
    END IF;

    v_quantity_change := p_new_quantity - v_current_quantity;

    UPDATE stocks
    SET quantity = p_new_quantity, updated_at = NOW()
    WHERE id = p_stock_id;

    INSERT INTO stock_movements (
        tenant_id, stock_id, movement_type, quantity,
        quantity_before, quantity_after, reason, user_id
    ) VALUES (
        v_tenant_id, p_stock_id, 'adjustment', v_quantity_change,
        v_current_quantity, p_new_quantity, p_reason, p_user_id
    )
    RETURNING * INTO v_movement;

    RETURN v_movement;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- =============================================
-- 15. Function: Process sale stock deduction
-- =============================================
CREATE OR REPLACE FUNCTION process_sale_stock_deduction(
    p_order_id UUID,
    p_tenant_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
    stock_id UUID,
    stock_name VARCHAR,
    deducted NUMERIC,
    new_quantity NUMERIC,
    is_low_stock BOOLEAN
) AS $$
DECLARE
    v_order_item RECORD;
    v_composition RECORD;
    v_stock RECORD;
    v_quantity_to_deduct NUMERIC;
    v_new_quantity NUMERIC;
    v_order_number VARCHAR;
BEGIN
    SELECT order_number INTO v_order_number FROM orders WHERE id = p_order_id;

    FOR v_order_item IN
        SELECT oi.product_id, oi.quantity, p.product_type, p.linked_stock_id
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = p_order_id
    LOOP
        IF v_order_item.product_type = 'composite' THEN
            FOR v_composition IN
                SELECT pc.stock_id, pc.factor, s.name as stock_name,
                       s.quantity, s.min_stock_level
                FROM product_composition pc
                JOIN stocks s ON s.id = pc.stock_id
                WHERE pc.product_id = v_order_item.product_id
                AND pc.tenant_id = p_tenant_id
            LOOP
                v_quantity_to_deduct := v_order_item.quantity * v_composition.factor;
                v_new_quantity := v_composition.quantity - v_quantity_to_deduct;

                UPDATE stocks
                SET quantity = v_new_quantity, updated_at = NOW()
                WHERE id = v_composition.stock_id;

                INSERT INTO stock_movements (
                    tenant_id, stock_id, movement_type, quantity,
                    quantity_before, quantity_after, reason,
                    reference_id, reference_type, user_id
                ) VALUES (
                    p_tenant_id, v_composition.stock_id, 'sale', -v_quantity_to_deduct,
                    v_composition.quantity, v_new_quantity,
                    'Venta orden #' || v_order_number,
                    p_order_id, 'order', p_user_id
                );

                stock_id := v_composition.stock_id;
                stock_name := v_composition.stock_name;
                deducted := v_quantity_to_deduct;
                new_quantity := v_new_quantity;
                is_low_stock := v_new_quantity <= v_composition.min_stock_level;
                RETURN NEXT;
            END LOOP;

        ELSIF v_order_item.linked_stock_id IS NOT NULL THEN
            SELECT s.* INTO v_stock
            FROM stocks s WHERE s.id = v_order_item.linked_stock_id;

            IF FOUND THEN
                v_quantity_to_deduct := v_order_item.quantity;
                v_new_quantity := v_stock.quantity - v_quantity_to_deduct;

                UPDATE stocks
                SET quantity = v_new_quantity, updated_at = NOW()
                WHERE id = v_order_item.linked_stock_id;

                INSERT INTO stock_movements (
                    tenant_id, stock_id, movement_type, quantity,
                    quantity_before, quantity_after, reason,
                    reference_id, reference_type, user_id
                ) VALUES (
                    p_tenant_id, v_order_item.linked_stock_id, 'sale', -v_quantity_to_deduct,
                    v_stock.quantity, v_new_quantity,
                    'Venta orden #' || v_order_number,
                    p_order_id, 'order', p_user_id
                );

                stock_id := v_order_item.linked_stock_id;
                stock_name := v_stock.name;
                deducted := v_quantity_to_deduct;
                new_quantity := v_new_quantity;
                is_low_stock := v_new_quantity <= v_stock.min_stock_level;
                RETURN NEXT;
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- =============================================
-- 16. Insert default unit_types (GLOBAL)
-- =============================================
INSERT INTO unit_types (code, name, allows_decimals) VALUES
    ('unit', 'Unidad', false),
    ('kg', 'Kilogramo', true),
    ('gr', 'Gramo', true),
    ('liter', 'Litro', true),
    ('ml', 'Mililitro', true)
ON CONFLICT (code) DO NOTHING;

-- =============================================
-- 17. Migrate existing products with stock to new system
-- =============================================
DO $$
DECLARE
    v_product RECORD;
    v_stock_id UUID;
    v_unit_type_id UUID;
BEGIN
    FOR v_product IN
        SELECT id, name, stock_quantity, min_stock_level, cost_price, tenant_id, unit_type
        FROM products
        WHERE (stock_quantity > 0 OR min_stock_level > 0)
        AND linked_stock_id IS NULL
    LOOP
        SELECT id INTO v_unit_type_id
        FROM unit_types
        WHERE code = COALESCE(v_product.unit_type, 'unit')
        LIMIT 1;

        IF v_unit_type_id IS NULL THEN
            SELECT id INTO v_unit_type_id
            FROM unit_types
            WHERE code = 'unit'
            LIMIT 1;
        END IF;

        INSERT INTO stocks (
            tenant_id, name, quantity, min_stock_level, cost_price, unit_type_id
        ) VALUES (
            v_product.tenant_id,
            v_product.name,
            COALESCE(v_product.stock_quantity, 0),
            COALESCE(v_product.min_stock_level, 0),
            COALESCE(v_product.cost_price, 0),
            v_unit_type_id
        )
        RETURNING id INTO v_stock_id;

        UPDATE products
        SET linked_stock_id = v_stock_id, product_type = 'simple'
        WHERE id = v_product.id;

        IF v_product.stock_quantity > 0 THEN
            INSERT INTO stock_movements (
                tenant_id, stock_id, movement_type, quantity,
                quantity_before, quantity_after, reason
            ) VALUES (
                v_product.tenant_id, v_stock_id, 'initial', v_product.stock_quantity,
                0, v_product.stock_quantity, 'Migración desde products.stock_quantity'
            );
        END IF;
    END LOOP;
END $$;

-- =============================================
-- 18. Add comments
-- =============================================
COMMENT ON TABLE unit_types IS 'Global units of measurement for inventory items (shared across all tenants)';
COMMENT ON TABLE stocks IS 'Inventory items / raw materials with quantity tracking';
COMMENT ON TABLE stock_movements IS 'Audit trail for all stock quantity changes';
COMMENT ON TABLE product_composition IS 'Bill of Materials - links products to their component stocks';
COMMENT ON COLUMN product_composition.factor IS 'Amount of stock consumed per unit of product sold (supports 4 decimals for weighable items)';
COMMENT ON COLUMN products.product_type IS 'simple = single stock item, composite = multiple stock items (recipe)';
COMMENT ON COLUMN products.linked_stock_id IS 'For simple products, direct link to their stock entry';
