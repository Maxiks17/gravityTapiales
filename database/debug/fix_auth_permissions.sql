-- Este script intenta reparar los permisos del esquema auth
-- Ejecútalo en el SQL Editor de tu nueva base de datos Supabase

BEGIN;

-- Asegurar uso del esquema auth
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin, postgres, anon, authenticated, service_role;

-- Otorgar privilegios al rol de administración de autenticación (GoTrue)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA auth TO supabase_auth_admin;

-- Asegurar que postgres también tenga acceso
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO postgres;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA auth TO postgres;

-- Asegurar que service_role tenga acceso adecuado (normalmente SELECT/INSERT/UPDATE/DELETE)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO service_role;

COMMIT;

-- Verificación (opcional)
-- SELECT * FROM auth.users LIMIT 1;
