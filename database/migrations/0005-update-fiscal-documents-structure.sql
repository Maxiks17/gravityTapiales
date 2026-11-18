-- Migration to update fiscal_documents table structure to match new definition

BEGIN;

-- 1. Add new columns
ALTER TABLE public.fiscal_documents
    ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS paid_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

-- 2. Drop columns that are no longer in the new structure
-- WARNING: This will delete data in these columns.
ALTER TABLE public.fiscal_documents
    DROP COLUMN IF EXISTS fdoc_type,
    DROP COLUMN IF EXISTS cae,
    DROP COLUMN IF EXISTS cae_expiration,
    DROP COLUMN IF EXISTS afip_response,
    DROP COLUMN IF EXISTS punto_venta,
    DROP COLUMN IF EXISTS fdoc_letter;

-- 3. Ensure indices exist
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_fdoc_date ON public.fiscal_documents USING btree (fdoc_date);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_order_id ON public.fiscal_documents USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_status ON public.fiscal_documents USING btree (status);

COMMIT;
