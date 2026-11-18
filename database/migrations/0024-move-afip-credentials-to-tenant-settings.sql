-- Migration: Move AFIP credential columns from customers_afip to tenants.settings
-- Date: 2026-05-29
--
-- Columns moved from customers_afip → tenants.settings keys:
--   estado                           → afip_status
--   certificado_encriptado           → afip_certificate_encrypted
--   certificado_private_key_encriptada → afip_private_key_encrypted
--   token                            → afip_token
--   sign                             → afip_sign
--   "expiration_Token"               → afip_expiration_token

-- 1. Migrate existing data into tenants.settings
UPDATE public.tenants t
SET settings = settings || jsonb_build_object(
    'afip_status',               ca.estado,
    'afip_certificate_encrypted', ca.certificado_encriptado,
    'afip_private_key_encrypted', ca.certificado_private_key_encriptada,
    'afip_token',                ca.token,
    'afip_sign',                 ca.sign,
    'afip_expiration_token',     ca."expiration_Token"
)
FROM public.customers_afip ca
WHERE ca.tenant_id = t.id;

-- 2. Drop the migrated columns from customers_afip
ALTER TABLE public.customers_afip
    DROP COLUMN IF EXISTS estado,
    DROP COLUMN IF EXISTS certificado_encriptado,
    DROP COLUMN IF EXISTS certificado_private_key_encriptada,
    DROP COLUMN IF EXISTS token,
    DROP COLUMN IF EXISTS sign,
    DROP COLUMN IF EXISTS "expiration_Token";
