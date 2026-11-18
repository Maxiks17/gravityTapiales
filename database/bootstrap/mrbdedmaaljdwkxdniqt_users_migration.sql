-- =====================================================
-- MIGRACIÓN DE USUARIOS - auth.users + user_tenants
-- Project ref (source): mrbdedmaaljdwkxdniqt
-- Date: 2025-12-23
--
-- IMPORTANTE: Ejecutar DESPUÉS del bootstrap principal
-- Este script migra los usuarios existentes con sus contraseñas
-- hasheadas, preservando los UUIDs originales.
-- =====================================================

-- =====================================================
-- 1. INSERTAR TENANTS (deben existir antes que user_tenants)
-- =====================================================

INSERT INTO public.tenants (id, name, slug, is_active, settings, created_at, updated_at) VALUES
    ('4e9bbee3-4fd7-4da6-b89b-62ff9f11ef2a', 'Yo Heladerías', 'dist-1573e0fc', true, '{"is_setup_complete": true}'::jsonb, '2025-11-26 03:55:48.847059+00', NOW()),
    ('fb7fb00f-6aa4-4afa-8f9a-fd405c531c04', 'FalopaFast', 'dist-2e4a6114-7782-4960', true, '{"is_setup_complete": true}'::jsonb, '2025-11-30 17:45:23.330529+00', NOW()),
    ('248d64de-60d6-4121-8b48-050c84f145ca', 'Pizzeria Don Dilo', 'dist-55b0cf87-7993-4e4b', true, '{"is_setup_complete": true}'::jsonb, '2025-12-15 21:27:35.974089+00', NOW()),
    ('67530087-4723-418b-bfe1-1cf592723b1c', 'Distribuidora Usuario', 'dist-898b9df0', true, '{"is_setup_complete": false}'::jsonb, '2025-12-15 22:26:57.67207+00', NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    settings = EXCLUDED.settings;

-- =====================================================
-- 2. INSERTAR USUARIOS EN auth.users
-- =====================================================
-- NOTA: Esto requiere permisos de superusuario o service_role
-- Las contraseñas ya están hasheadas (bcrypt)

INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
) VALUES
    -- Usuario: maxi1792@gmail.com
    (
        'c2f6045c-0c7b-41df-b0c2-566c2f25f507',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'maxi1792@gmail.com',
        '$2a$10$Aa.Is4Qj9C6Mx6u5tQL.Y.RP6lqCf7Ma2nB5Dc2BwxHcV6bGtf0RG',
        '2025-11-22 23:48:35.38329+00',
        '{"email_verified":true}'::jsonb,
        '2025-11-22 23:48:35.3489+00',
        '2025-12-15 22:19:55.49444+00',
        '', '', '', ''
    ),
    -- Usuario: maximiliano.kiss.ar@gmail.com
    (
        '1573e0fc-ce87-4e18-bfde-399dd1f62322',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'maximiliano.kiss.ar@gmail.com',
        '$2a$10$dH7HQiKyk6sNRDAgZ0dpWub4dzSQN0tfSkxKvQg5qoeKe67EJhu6W',
        '2025-11-26 03:45:41.204119+00',
        '{"sub":"1573e0fc-ce87-4e18-bfde-399dd1f62322","email":"maximiliano.kiss.ar@gmail.com","email_verified":true,"phone_verified":false}'::jsonb,
        '2025-11-26 03:45:30.454128+00',
        '2025-12-22 04:43:52.302773+00',
        '', '', '', ''
    ),
    -- Usuario: homecavs@gmail.com
    (
        '8817c7f7-ed5c-4b32-9244-81c75a31f0e2',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'homecavs@gmail.com',
        '$2a$10$vwDuFZFwOxASyNxkrUvrs.yEVUTzp7Cl2g6C1jp3f4zKj8d29BoOG',
        '2025-11-30 17:45:37.489543+00',
        '{"sub":"8817c7f7-ed5c-4b32-9244-81c75a31f0e2","email":"homecavs@gmail.com","email_verified":true,"phone_verified":false}'::jsonb,
        '2025-11-30 17:45:23.330897+00',
        '2025-12-14 22:20:07.356176+00',
        '', '', '', ''
    ),
    -- Usuario: homecavs+test@gmail.com
    (
        '0f3a1ba5-81b3-4bb5-948e-14161b9d0b69',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'homecavs+test@gmail.com',
        '$2a$10$O.DcIwrb7NdQdb3DjqlgSeHc19WKpijQnKAcqnjlK/iCS3Q23vIu.',
        '2025-12-15 00:37:00.778863+00',
        '{"email_verified":true}'::jsonb,
        '2025-12-15 00:36:37.006679+00',
        '2025-12-15 00:37:01.065996+00',
        '', '', '', ''
    ),
    -- Usuario: lucianodipizio@hotmail.com
    (
        '4e748912-7076-4131-ac66-06368120e579',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'lucianodipizio@hotmail.com',
        '$2a$10$FdRTVUSuUxV8k3Sm9PvJmuUqKyvJOhr3xT5fqBAzK9QaJbUgI5XLG',
        '2025-12-15 21:28:52.088944+00',
        '{"email_verified":true}'::jsonb,
        '2025-12-15 21:27:35.975591+00',
        '2025-12-15 23:48:38.315628+00',
        '', '', '', ''
    ),
    -- Usuario: codigo1899@gmail.com
    (
        '898b9df0-e54e-4adf-afe3-07f52f6664a6',
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'codigo1899@gmail.com',
        '$2a$10$21iUTBYy1PMUhL3jPTyfnO/zMeTPUjaYJ8/.EOTfHHl/Kh7khJFJK',
        '2025-12-15 22:27:26.784084+00',
        '{"email_verified":true}'::jsonb,
        '2025-12-15 22:26:57.67207+00',
        '2025-12-16 03:25:49.398379+00',
        '', '', '', ''
    )
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = NOW();

-- =====================================================
-- 3. INSERTAR IDENTIDADES (auth.identities)
-- =====================================================
-- Necesario para que funcione el login por email

INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT 
    id,
    id,
    email,
    jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
    'email',
    email_confirmed_at,
    created_at,
    updated_at
FROM auth.users
WHERE id IN (
    'c2f6045c-0c7b-41df-b0c2-566c2f25f507',
    '1573e0fc-ce87-4e18-bfde-399dd1f62322',
    '8817c7f7-ed5c-4b32-9244-81c75a31f0e2',
    '0f3a1ba5-81b3-4bb5-948e-14161b9d0b69',
    '4e748912-7076-4131-ac66-06368120e579',
    '898b9df0-e54e-4adf-afe3-07f52f6664a6'
)
ON CONFLICT (provider, provider_id) DO NOTHING;

-- =====================================================
-- 4. INSERTAR RELACIONES USER_TENANTS
-- =====================================================
-- El trigger on_auth_user_created NO se dispara en INSERT directo
-- así que debemos crear las relaciones manualmente

INSERT INTO public.user_tenants (id, user_id, tenant_id, role, is_active, created_at) VALUES
    ('cdb6c2ab-b5fa-4212-89b6-aa79b255e99b', '1573e0fc-ce87-4e18-bfde-399dd1f62322', '4e9bbee3-4fd7-4da6-b89b-62ff9f11ef2a', 'admin', true, '2025-11-26 03:55:48.847059+00'),
    ('cc77f4b0-f946-400f-9558-86d146cd1c01', '8817c7f7-ed5c-4b32-9244-81c75a31f0e2', 'fb7fb00f-6aa4-4afa-8f9a-fd405c531c04', 'admin', true, '2025-11-30 17:45:23.330529+00'),
    ('4a701614-531a-43b6-b3e9-353b7cdb28f0', '4e748912-7076-4131-ac66-06368120e579', '248d64de-60d6-4121-8b48-050c84f145ca', 'admin', true, '2025-12-15 21:27:35.974089+00'),
    ('66fb4ed0-6247-4018-899a-72fb8d99739a', '898b9df0-e54e-4adf-afe3-07f52f6664a6', '67530087-4723-418b-bfe1-1cf592723b1c', 'admin', true, '2025-12-15 22:26:57.67207+00')
ON CONFLICT (user_id, tenant_id) DO UPDATE SET
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
--
-- 1. Este script preserva:
--    - UUIDs originales de usuarios
--    - Contraseñas hasheadas (los usuarios pueden seguir usando sus mismas contraseñas)
--    - Fechas de creación y confirmación de email
--    - Relaciones user-tenant
--
-- 2. Usuarios sin password (email_confirmed_at = NULL):
--    - maximiliano.kiss.ar+test@gmail.com
--    - homecavs+exp2212@gmail.com
--    Estos usuarios nunca completaron el registro, no se incluyen.
--
-- 3. El usuario maxi1792@gmail.com no tiene tenant asociado en la tabla
--    user_tenants original. Deberás asignarlo manualmente si es necesario.
--
-- 4. Después de ejecutar, verifica que los usuarios puedan hacer login.
--
-- =====================================================
