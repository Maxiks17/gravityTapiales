-- =============================================
-- Migration: Add Order Payments for Mixed Payments Support
-- Description: Creates order_payments table to support multiple payment methods per order
-- Author: System
-- Date: 2025-01-14
-- =============================================

-- 1. Create order_payments table
CREATE TABLE IF NOT EXISTS order_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_order_payments_tenant ON order_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_order ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_method ON order_payments(payment_method_id);

-- 3. Enable RLS
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if any
DROP POLICY IF EXISTS "Users can view order payments from their tenant" ON order_payments;
DROP POLICY IF EXISTS "Users can insert order payments for their tenant" ON order_payments;
DROP POLICY IF EXISTS "Users can update order payments from their tenant" ON order_payments;
DROP POLICY IF EXISTS "Users can delete order payments from their tenant" ON order_payments;

-- 5. Create RLS policies using user_tenants table
CREATE POLICY "Users can view order payments from their tenant"
    ON order_payments FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert order payments for their tenant"
    ON order_payments FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id
            FROM user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update order payments from their tenant"
    ON order_payments FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM user_tenants
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete order payments from their tenant"
    ON order_payments FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM user_tenants
            WHERE user_id = auth.uid()
        )
    );

-- 6. Create trigger to auto-set tenant_id
CREATE OR REPLACE FUNCTION auto_set_tenant_id_order_payments()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tenant_id IS NULL THEN
        SELECT tenant_id INTO NEW.tenant_id
        FROM user_tenants
        WHERE user_id = auth.uid()
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS set_tenant_id_order_payments ON order_payments;
CREATE TRIGGER set_tenant_id_order_payments
    BEFORE INSERT ON order_payments
    FOR EACH ROW
    EXECUTE FUNCTION auto_set_tenant_id_order_payments();

-- 7. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_order_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS order_payments_updated_at ON order_payments;
CREATE TRIGGER order_payments_updated_at
    BEFORE UPDATE ON order_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_order_payments_updated_at();

-- 8. MIGRATE EXISTING DATA from orders.payment_method_id to order_payments
INSERT INTO order_payments (tenant_id, order_id, payment_method_id, amount)
SELECT
    o.tenant_id,
    o.id AS order_id,
    o.payment_method_id,
    o.total_amount AS amount
FROM orders o
WHERE o.payment_method_id IS NOT NULL
  AND o.tenant_id IS NOT NULL;

-- 9. Add comments to document the schema
COMMENT ON TABLE order_payments IS 'Multiple payment methods per order support (mixed payments)';
COMMENT ON COLUMN order_payments.amount IS 'Amount paid with this specific payment method';
COMMENT ON COLUMN orders.payment_method_id IS 'DEPRECATED: Use order_payments table for payment methods. Kept for backward compatibility.';
