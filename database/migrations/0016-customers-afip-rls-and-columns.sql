-- Migration: Add RLS policies and missing columns to customers_afip table
-- Date: 2026-02-16
-- Fixes: 406 error when querying customers_afip (RLS enabled but no policies)

-- 1. Add RLS policies matching tenant_isolation pattern
CREATE POLICY "tenant_isolation_select" ON public.customers_afip
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_insert" ON public.customers_afip
  FOR INSERT WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_update" ON public.customers_afip
  FOR UPDATE USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_isolation_delete" ON public.customers_afip
  FOR DELETE USING (tenant_id = get_user_tenant_id());

-- 2. Add missing token, sign, and expiracion_Token columns
ALTER TABLE public.customers_afip 
  ADD COLUMN IF NOT EXISTS token text NULL;

ALTER TABLE public.customers_afip 
  ADD COLUMN IF NOT EXISTS sign text NULL;

ALTER TABLE public.customers_afip 
  ADD COLUMN IF NOT EXISTS "expiracion_Token" timestamp with time zone NULL;

COMMENT ON COLUMN public.customers_afip.token IS 'AFIP authentication token (base64 encoded XML)';
COMMENT ON COLUMN public.customers_afip.sign IS 'Cryptographic signature for the AFIP authentication token';
COMMENT ON COLUMN public.customers_afip."expiracion_Token" IS 'Expiration date and time of the AFIP authentication token';
