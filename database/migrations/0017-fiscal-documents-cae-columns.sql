-- Add CAE and CAE expiration date columns to fiscal_documents
-- These store the response from AFIP when generating an invoice

ALTER TABLE public.fiscal_documents
  ADD COLUMN IF NOT EXISTS cae character varying(20) NULL,
  ADD COLUMN IF NOT EXISTS cae_expiration_date timestamp with time zone NULL;

COMMENT ON COLUMN public.fiscal_documents.cae IS 'CAE (Código de Autorización Electrónico) returned by AFIP';
COMMENT ON COLUMN public.fiscal_documents.cae_expiration_date IS 'CAE expiration date returned by AFIP';
