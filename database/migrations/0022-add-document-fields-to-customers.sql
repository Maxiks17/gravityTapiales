-- Add AFIP-compatible document fields to customers
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS document_type INTEGER,
ADD COLUMN IF NOT EXISTS document_number VARCHAR(20);

-- Migrate legacy tax_id (CUIT/CUIL/etc) into document fields when possible
UPDATE public.customers
SET
  document_type = COALESCE(document_type, 80),
  document_number = COALESCE(document_number, LEFT(regexp_replace(COALESCE(tax_id, ''), '\\D', '', 'g'), 20))
WHERE tax_id IS NOT NULL
  AND tax_id <> ''
  AND (document_number IS NULL OR document_number = '');

-- Remove legacy CUIT field from customers
ALTER TABLE public.customers
DROP COLUMN IF EXISTS tax_id;

-- Ensure document type uses AFIP TipoDocumento values
ALTER TABLE public.customers
DROP CONSTRAINT IF EXISTS customers_document_type_check;

ALTER TABLE public.customers
ADD CONSTRAINT customers_document_type_check
CHECK (
  document_type IS NULL OR document_type IN (0, 80, 86, 87, 89, 90, 91, 92, 93, 94, 95, 96, 99)
);

-- Enforce digits-only document number and max length (VARCHAR(20) already limits length)
ALTER TABLE public.customers
DROP CONSTRAINT IF EXISTS customers_document_number_digits_check;

ALTER TABLE public.customers
ADD CONSTRAINT customers_document_number_digits_check
CHECK (
  document_number IS NULL OR document_number ~ '^[0-9]{1,20}$'
);
