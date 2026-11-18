-- Fix: fdoc_number should be unique per tenant, not globally
-- Also allows upsert on (fdoc_number, tenant_id) for retry scenarios

ALTER TABLE public.fiscal_documents DROP CONSTRAINT IF EXISTS fiscal_documents_fdoc_number_key;
ALTER TABLE public.fiscal_documents ADD CONSTRAINT fiscal_documents_fdoc_number_tenant_key UNIQUE (fdoc_number, tenant_id);
