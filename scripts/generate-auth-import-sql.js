import fs from 'node:fs/promises';
import path from 'node:path';

async function main() {
  try {
    // Leer el archivo JSON exportado
    const jsonContent = await fs.readFile('auth_users_export.json', 'utf-8');
    const users = JSON.parse(jsonContent);

    if (!users || users.length === 0) {
      console.log('No hay usuarios para importar.');
      return;
    }

    console.log(`Generando SQL para ${users.length} usuarios...`);

    let sql = `-- Script generado para importar usuarios a auth.users
-- Ejecuta este script en el SQL Editor de tu proyecto destino en Supabase.

BEGIN;

-- Opcional: Deshabilitar triggers si tienes permisos (puede requerir rol de superusuario)
-- ALTER TABLE auth.users DISABLE TRIGGER ALL;

`;

    for (const user of users) {
      // Mapeo de campos del JSON a columnas de la tabla auth.users
      // Nota: No tenemos el password hash, así que establecemos uno inválido o dummy.
      // Los usuarios deberán restablecer su contraseña.
      
      const id = user.id;
      const email = user.email ? `'${user.email}'` : 'NULL';
      const encrypted_password = user.encrypted_password ? `'${user.encrypted_password}'` : 'NULL';
      const email_confirmed_at = user.email_confirmed_at ? `'${user.email_confirmed_at}'` : 'NULL';
      const invited_at = user.invited_at ? `'${user.invited_at}'` : 'NULL';
      const confirmation_token = user.confirmation_token ? `'${user.confirmation_token}'` : 'NULL';
      const confirmation_sent_at = user.confirmation_sent_at ? `'${user.confirmation_sent_at}'` : 'NULL';
      const recovery_token = user.recovery_token ? `'${user.recovery_token}'` : 'NULL';
      const recovery_sent_at = user.recovery_sent_at ? `'${user.recovery_sent_at}'` : 'NULL';
      const email_change_token_new = user.email_change_token_new ? `'${user.email_change_token_new}'` : 'NULL';
      const email_change = user.email_change ? `'${user.email_change}'` : 'NULL';
      const email_change_sent_at = user.email_change_sent_at ? `'${user.email_change_sent_at}'` : 'NULL';
      const last_sign_in_at = user.last_sign_in_at ? `'${user.last_sign_in_at}'` : 'NULL';
      
      // JSON fields need careful escaping
      const raw_app_meta_data = (user.raw_app_meta_data || user.app_metadata) ? `'${JSON.stringify(user.raw_app_meta_data || user.app_metadata)}'` : `'{}'`;
      const raw_user_meta_data = (user.raw_user_meta_data || user.user_metadata) ? `'${JSON.stringify(user.raw_user_meta_data || user.user_metadata)}'` : `'{}'`;
      
      const is_super_admin = user.is_super_admin ? 'TRUE' : 'FALSE';
      const created_at = user.created_at ? `'${user.created_at}'` : 'NOW()';
      const updated_at = user.updated_at ? `'${user.updated_at}'` : 'NOW()';
      const phone = user.phone ? `'${user.phone}'` : 'NULL';
      const phone_confirmed_at = user.phone_confirmed_at ? `'${user.phone_confirmed_at}'` : 'NULL';
      const phone_change = user.phone_change ? `'${user.phone_change}'` : 'NULL';
      const phone_change_token = user.phone_change_token ? `'${user.phone_change_token}'` : 'NULL';
      const phone_change_sent_at = user.phone_change_sent_at ? `'${user.phone_change_sent_at}'` : 'NULL';
      const email_change_token_current = user.email_change_token_current ? `'${user.email_change_token_current}'` : 'NULL';
      const email_change_confirm_status = user.email_change_confirm_status || 0;
      const banned_until = user.banned_until ? `'${user.banned_until}'` : 'NULL';
      const reauthentication_token = user.reauthentication_token ? `'${user.reauthentication_token}'` : 'NULL';
      const reauthentication_sent_at = user.reauthentication_sent_at ? `'${user.reauthentication_sent_at}'` : 'NULL';
      const is_sso_user = user.is_sso_user ? 'TRUE' : 'FALSE'; // A veces no viene en el JSON
      const deleted_at = user.deleted_at ? `'${user.deleted_at}'` : 'NULL';
      const aud = user.aud ? `'${user.aud}'` : `'authenticated'`;
      const role = user.role ? `'${user.role}'` : `'authenticated'`;

      // Construir el INSERT
      sql += `
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at,
  is_sso_user,
  deleted_at
) VALUES (
  '00000000-0000-0000-0000-000000000000', -- instance_id default
  '${id}',
  ${aud},
  ${role},
  ${email},
  ${encrypted_password}, -- Password perdido en exportación JSON
  ${email_confirmed_at},
  ${invited_at},
  ${confirmation_token},
  ${confirmation_sent_at},
  ${recovery_token},
  ${recovery_sent_at},
  ${email_change_token_new},
  ${email_change},
  ${email_change_sent_at},
  ${last_sign_in_at},
  ${raw_app_meta_data},
  ${raw_user_meta_data},
  ${is_super_admin},
  ${created_at},
  ${updated_at},
  ${phone},
  ${phone_confirmed_at},
  ${phone_change},
  ${phone_change_token},
  ${phone_change_sent_at},
  ${email_change_token_current},
  ${email_change_confirm_status},
  ${banned_until},
  ${reauthentication_token},
  ${reauthentication_sent_at},
  ${is_sso_user},
  ${deleted_at}
) ON CONFLICT (id) DO NOTHING;
`;
    }

    sql += `
-- ALTER TABLE auth.users ENABLE TRIGGER ALL;
COMMIT;
`;

    const outputFilename = 'auth_users_import.sql';
    await fs.writeFile(outputFilename, sql);
    console.log(`\n¡Éxito! Se generó el archivo SQL: ${outputFilename}`);
    console.log('IMPORTANTE: Este script no incluye las contraseñas (hashes) porque no son exportables vía API.');
    console.log('Los usuarios deberán usar "Olvidé mi contraseña" para recuperar el acceso.');

  } catch (error) {
    console.error('Error generando SQL:', error);
  }
}

main();
