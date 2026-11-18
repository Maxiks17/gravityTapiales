ALTER TABLE orders
ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(10, 2) DEFAULT 0;

COMMENT ON COLUMN orders.discount_percent IS 'Porcentaje de descuento aplicado al total del pedido';