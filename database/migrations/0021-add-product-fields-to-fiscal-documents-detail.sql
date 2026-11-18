-- Add product-level fields to fiscal_documents_detail

ALTER TABLE public.fiscal_documents_detail
    ADD COLUMN IF NOT EXISTS order_item_id UUID NULL REFERENCES public.order_items(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS product_id UUID NULL REFERENCES public.products(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS product_name TEXT NULL,
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS line_subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS line_total NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_fdoc_detail_order_item_id ON public.fiscal_documents_detail(order_item_id);
CREATE INDEX IF NOT EXISTS idx_fdoc_detail_product_id ON public.fiscal_documents_detail(product_id);
