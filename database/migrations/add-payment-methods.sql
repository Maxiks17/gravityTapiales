-- =============================================
-- Migration: Add Payment Methods and Update Table Status
-- Description: Creates payment_methods table and adds WAITING_PAYMENT status
-- Author: System
-- Date: 2025-12-08
-- =============================================

-- 1. Create payment_methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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

-- 2. Create index for tenant queries
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant ON payment_methods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods(tenant_id, is_active);

-- 3. Enable RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if any
DROP POLICY IF EXISTS "Users can view payment methods from their tenant" ON payment_methods;
DROP POLICY IF EXISTS "Users can insert payment methods for their tenant" ON payment_methods;
DROP POLICY IF EXISTS "Users can update payment methods from their tenant" ON payment_methods;
DROP POLICY IF EXISTS "Users can delete payment methods from their tenant" ON payment_methods;

-- 5. Create RLS policies using user_tenants table
CREATE POLICY "Users can view payment methods from their tenant"
    ON payment_methods FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM user_tenants 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert payment methods for their tenant"
    ON payment_methods FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id 
            FROM user_tenants 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update payment methods from their tenant"
    ON payment_methods FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM user_tenants 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete payment methods from their tenant"
    ON payment_methods FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM user_tenants 
            WHERE user_id = auth.uid()
        )
    );

-- 6. Create trigger to auto-set tenant_id
CREATE OR REPLACE FUNCTION auto_set_tenant_id_payment_methods()
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

DROP TRIGGER IF EXISTS set_tenant_id_payment_methods ON payment_methods;
CREATE TRIGGER set_tenant_id_payment_methods
    BEFORE INSERT ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION auto_set_tenant_id_payment_methods();

-- 7. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_payment_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS payment_methods_updated_at ON payment_methods;
CREATE TRIGGER payment_methods_updated_at
    BEFORE UPDATE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_methods_updated_at();

-- 8. Add payment_method_id to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method_id);

-- 9. Insert default payment methods (will be inserted per tenant via trigger or app)
-- This is just a comment for reference - actual insertion happens in the app

-- 10. Update tables status CHECK constraint to include WAITING_PAYMENT
-- Drop the old constraint and create a new one with the additional status
ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_status_check;
ALTER TABLE tables ADD CONSTRAINT tables_status_check 
    CHECK (status IN ('FREE', 'OCCUPIED', 'RESERVED', 'WAITING_PAYMENT'));

COMMENT ON TABLE payment_methods IS 'Payment methods for orders - auto_invoice true means digital payment that triggers automatic invoicing';
COMMENT ON COLUMN payment_methods.auto_invoice IS 'If true, payment creates invoice automatically (digital). If false, creates order only (cash/manual)';
COMMENT ON COLUMN payment_methods.icon IS 'Lucide icon name for UI display';
COMMENT ON COLUMN orders.payment_method_id IS 'Payment method used for this order';
