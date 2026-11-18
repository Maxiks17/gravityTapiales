# Guía: Agregar un Claim Personalizado (tenant_id) al JWT en Supabase

## 📌 Objetivo

Modificar el JSON Web Token (JWT) generado por Supabase Authentication para incluir un claim personalizado `tenant_id`, obtenido desde una tabla personalizada `public.user_tenants`

## 🚀 Implementación Paso a Paso

*Aclaracion: Los siguientes scripts se tienen que ejecutar en el **SQL Editor** de Supabase*

### 1. Crear la Función Hook

Esta función se ejecuta durante el proceso de autenticación y modifica los claims del JWT.

```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
    claims jsonb;
    v_tenant_id uuid;
begin
    -- 1. Obtener el tenant_id del usuario desde la tabla personalizada
    select ut.tenant_id
    into v_tenant_id
    from public.user_tenants ut
    where ut.user_id = (event->>'user_id')::uuid;

    -- 2. Obtener los claims actuales del evento
    claims := event->'claims';

    -- 3. Si se encuentra un tenant_id, agregarlo como un claim personalizado
    if v_tenant_id is not null then
        claims := jsonb_set(claims, '{"tenant_id"}', to_jsonb(v_tenant_id));
    -- Si no se encuentra, los claims permanecen sin cambios
    else
        claims := claims;
    end if;

    -- 4. Actualizar el objeto 'claims' en el evento y devolverlo
    event := jsonb_set(event, '{claims}', claims);
    return event;
end;
$$;
```

### 2. Configurar Permisos y Seguridad

- Permisos (GRANT/REVOKE). Estos permisos normalmente se configuran automaticamente al activar el hook en el Dashboard, por lo que no es necesario correrlos manualmente, igualmente los dejo aca para tener de referencia.
```sql
-- Grant access to function to supabase_auth_admin
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
-- Grant access to schema to supabase_auth_admin
grant usage on schema public to supabase_auth_admin;
-- Revoke function permissions from authenticated, anon and public
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
```

- Habilitar **RLS** en la tabla `public.user_tenants` si no lo esta
```sql
alter table public.user_tenants enable row level security;
```

- Crear una política que permita al rol `supabase_auth_admin` leer la tabla `public.user_tenants`
```sql
create policy "Allow auth admin to read user tenants"
on public.user_tenants for select
to supabase_auth_admin
using (true);

GRANT SELECT ON TABLE public.user_tenants TO supabase_auth_admin;
```

### 3. Activar el Hook en el Dashboard

1. Ve a **Authentication** en el menú de tu proyecto Supabase.

2. Selecciona la pestaña **Hooks (Beta)**.

3. En la sección **"Custom Access Token Hook"**, selecciona la función `public.custom_access_token_hook` de la lista desplegable.

4. Guarda los cambios.

## ✅ Verificacion

La manera mas facil y directa es hacer el login a la App y obtener el JWT del localStorage que es donde lo guarda Supabase y decodificarlo en [jwt.io](https://jwt.io) en la seccion de payload del token deberia estar el `tenant_id`
```json
{
  "sub": "user-uuid",
  "email": "...",
  "tenant_id": "tenant-uuid", // <- Claim personalizado agregado
  ...
}
```