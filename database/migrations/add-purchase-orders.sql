-- Add tax_rate column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2);

-- Add comment to explain the column
COMMENT ON COLUMN products.tax_rate IS 'Tax rate percentage (5, 10.5, 21, or 27)';

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_number VARCHAR(50) UNIQUE NOT NULL,
    distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE RESTRICT,
    order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_delivery_date DATE,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'received', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL,
    subtotal NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_distributor ON purchase_orders(distributor_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date ON purchase_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product ON purchase_order_items(product_id);

-- Create product_distributors junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS product_distributors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    distributor_id UUID NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(product_id, distributor_id)
);

-- Create index for the junction table
CREATE INDEX IF NOT EXISTS idx_product_distributors_product ON product_distributors(product_id);
CREATE INDEX IF NOT EXISTS idx_product_distributors_distributor ON product_distributors(distributor_id);

-- Update trigger for purchase_orders updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_distributors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_orders (authenticated users can do everything)
CREATE POLICY "Enable read access for authenticated users" ON purchase_orders
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON purchase_orders
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON purchase_orders
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete access for authenticated users" ON purchase_orders
    FOR DELETE TO authenticated USING (true);

-- RLS Policies for purchase_order_items
CREATE POLICY "Enable read access for authenticated users" ON purchase_order_items
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON purchase_order_items
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON purchase_order_items
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete access for authenticated users" ON purchase_order_items
    FOR DELETE TO authenticated USING (true);

-- RLS Policies for product_distributors
CREATE POLICY "Enable read access for authenticated users" ON product_distributors
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON product_distributors
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON product_distributors
    FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete access for authenticated users" ON product_distributors
    FOR DELETE TO authenticated USING (true);

-- Grant permissions
GRANT ALL ON purchase_orders TO authenticated;
GRANT ALL ON purchase_order_items TO authenticated;
GRANT ALL ON product_distributors TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE purchase_orders IS 'Store purchase orders from distributors';
COMMENT ON TABLE purchase_order_items IS 'Store line items for each purchase order';
COMMENT ON TABLE product_distributors IS 'Many-to-many relationship between products and distributors';
