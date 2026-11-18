-- Migration: Complete AFIP certificate refactoring
-- This migration combines multiple changes:
-- 1. Rename afip_certificate_password to afip_certificate_private_key in tenant settings
-- 2. Rename clientes table to customers_afip
-- 3. Update trigger function to work with new table and field names
-- 4. Clean up old columns and data

-- Step 1: Update tenant settings to rename the field
UPDATE tenants 
SET settings = settings - 'afip_certificate_password' || jsonb_build_object('afip_certificate_private_key', COALESCE(settings->>'afip_certificate_password', ''))
WHERE settings ? 'afip_certificate_password';

-- Step 2: Rename the table
ALTER TABLE clientes RENAME TO customers_afip;

-- Step 3: Drop the old trigger if it exists
DROP TRIGGER IF EXISTS sync_tenant_settings_trigger ON tenants;

-- Step 4: Create or replace the function with updated table and field references
CREATE OR REPLACE FUNCTION sync_tenant_settings_to_customers_afip()
RETURNS TRIGGER AS $$
DECLARE
    v_cuit text;
    v_certificate text;
    v_private_key text;
    v_email text;
BEGIN
    -- Extract values from new settings
    v_cuit := NEW.settings->>'company_cuit';
    v_certificate := NEW.settings->>'afip_certificate';
    v_private_key := NEW.settings->>'afip_certificate_private_key';
    v_email := NEW.email;

    -- Only proceed if we have a CUIT
    IF v_cuit IS NOT NULL AND v_cuit <> '' THEN
        -- Insert or update the customer record
        INSERT INTO customers_afip (
            tenant_id,
            nombre,
            email,
            telefono,
            direccion,
            cuit,
            certificado_encriptado,
            certificado_private_key_encriptada,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            NEW.name,
            v_email,
            NEW.phone,
            NEW.address,
            v_cuit,
            v_certificate,
            v_private_key,
            NOW(),
            NOW()
        )
        ON CONFLICT (tenant_id, cuit)
        DO UPDATE SET
            nombre = EXCLUDED.nombre,
            email = EXCLUDED.email,
            telefono = EXCLUDED.telefono,
            direccion = EXCLUDED.direccion,
            certificado_encriptado = EXCLUDED.certificado_encriptado,
            certificado_private_key_encriptada = EXCLUDED.certificado_private_key_encriptada,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create the new trigger
CREATE TRIGGER sync_tenant_settings_trigger
    AFTER INSERT OR UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION sync_tenant_settings_to_customers_afip();

-- Step 6: Update existing customer records to use the new field name (if the old column exists)
UPDATE customers_afip 
SET certificado_private_key_encriptada = password_encriptada
WHERE password_encriptada IS NOT NULL;

-- Step 7: Remove the old column if it exists (this is safe as we've migrated the data)
ALTER TABLE customers_afip DROP COLUMN IF EXISTS password_encriptada;