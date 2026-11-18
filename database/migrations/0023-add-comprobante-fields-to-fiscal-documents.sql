-- Add AFIP voucher identification fields to fiscal_documents
-- These columns store the exact voucher coordinates returned by AFIP

ALTER TABLE public.fiscal_documents
    ADD COLUMN IF NOT EXISTS punto_de_venta  INTEGER NULL CHECK (punto_de_venta  BETWEEN 1 AND 1000),
    ADD COLUMN IF NOT EXISTS tipo_comprobante INTEGER NULL CHECK (tipo_comprobante BETWEEN 1 AND 100),
    ADD COLUMN IF NOT EXISTS numero_comprobante INTEGER NULL CHECK (numero_comprobante BETWEEN 1 AND 9999999);

COMMENT ON COLUMN public.fiscal_documents.punto_de_venta    IS 'Punto de venta AFIP (1-1000)';
COMMENT ON COLUMN public.fiscal_documents.tipo_comprobante  IS 'Tipo de comprobante AFIP (1-100), ver TipoComprobante enum';
COMMENT ON COLUMN public.fiscal_documents.numero_comprobante IS 'Numero de comprobante devuelto por AFIP (1-9999999)';
