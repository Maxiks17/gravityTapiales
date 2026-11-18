-- Function to sync tenant settings to clientes table
CREATE OR REPLACE FUNCTION public.sync_tenant_settings_to_clientes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_cuit text;
    v_certificate text;
    v_password text;
    v_email text;
BEGIN
    -- Extract values from new settings
    v_cuit := NEW.settings->>'company_cuit';
    v_certificate := NEW.settings->>'afip_certificate';
    v_password := NEW.settings->>'afip_certificate_password';
    v_email := NEW.email;

    -- Only proceed if we have a CUIT
    IF v_cuit IS NOT NULL AND v_cuit <> '' THEN
        
        -- Check if we need to update or insert
        -- We use ON CONFLICT for concurrency safety, but we need to handle the email constraint too.
        -- If the email exists for a DIFFERENT CUIT, we might have an issue. 
        -- Assuming 1-to-1 or that email is unique per client/tenant.

        INSERT INTO public.clientes (
            nombre,
            apellido,
            cuit,
            email,
            estado,
            certificado_encriptado,
            password_encriptada,
            fecha_creacion,
            fecha_modificacion
        ) VALUES (
            '', -- nombre vacio
            '', -- apellido vacio
            v_cuit,
            COALESCE(v_email, ''), -- email from tenant
            false, -- estado false
            COALESCE(v_certificate, ''),
            COALESCE(v_password, ''),
            NOW(),
            NOW()
        )
        ON CONFLICT (cuit) DO UPDATE SET
            certificado_encriptado = EXCLUDED.certificado_encriptado,
            password_encriptada = EXCLUDED.password_encriptada,
            fecha_modificacion = NOW();
            
    END IF;

    RETURN NEW;
END;
$function$;

-- Trigger definition
DROP TRIGGER IF EXISTS trigger_sync_tenant_settings_to_clientes ON public.tenants;

CREATE TRIGGER trigger_sync_tenant_settings_to_clientes
    AFTER INSERT OR UPDATE OF settings ON public.tenants
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_tenant_settings_to_clientes();
