-- =====================================================
-- MIGRATION: Add Price Lists and Order Adjustments
-- =====================================================

-- 1. Create Price Lists table
CREATE TABLE IF NOT EXISTS price_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) DEFAULT 'percentage', -- 'percentage' is the main one for now
    value DECIMAL(10, 2) DEFAULT 0, -- e.g., 10.00 (surcharge), -5.00 (discount)
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add RLS policies for price_lists
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON price_lists
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON price_lists
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON price_lists
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON price_lists
    FOR DELETE USING (auth.role() = 'authenticated');

-- 3. Add price_list_id to customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS price_list_id UUID REFERENCES price_lists(id) ON DELETE SET NULL;

-- 4. Add adjustment fields to orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS applied_price_list_id UUID REFERENCES price_lists(id),
ADD COLUMN IF NOT EXISTS applied_adjustment_value DECIMAL(10, 2) DEFAULT 0; -- Snapshot of the value at order time
