import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import process from 'node:process';

// Lee las variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Se requieren las variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Ejemplo de uso:');
  console.error('SUPABASE_URL="https://tu-proyecto.supabase.co" SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key" node scripts/export-auth-users.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function getAllUsers() {
  let allUsers = [];
  let page = 1;
  const perPage = 50;

  console.log('Iniciando exportación de usuarios...');

  while (true) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
      page: page,
      perPage: perPage
    });
    
    if (error) {
      throw error;
    }
    
    if (!users || users.length === 0) {
      break;
    }
    
    allUsers = allUsers.concat(users);
    console.log(`Obtenidos ${users.length} usuarios de la página ${page}. Total acumulado: ${allUsers.length}`);
    page++;
  }
  
  return allUsers;
}

async function main() {
  try {
    const users = await getAllUsers();
    
    const filename = 'auth_users_export.json';
    await fs.writeFile(filename, JSON.stringify(users, null, 2));
    
    console.log(`\n¡Éxito! Se exportaron ${users.length} usuarios a ${filename}`);
    
    // Opcional: Crear también un CSV simple
    if (users.length > 0) {
        const csvFilename = 'auth_users_export.csv';
        const headers = ['id', 'email', 'created_at', 'last_sign_in_at', 'role'];
        const csvContent = [
            headers.join(','),
            ...users.map(u => headers.map(h => u[h] || '').join(','))
        ].join('\n');
        
        await fs.writeFile(csvFilename, csvContent);
        console.log(`También se creó una versión CSV en ${csvFilename}`);
    }

  } catch (error) {
    console.error('Error exportando usuarios:', error);
    process.exit(1);
  }
}

main();
