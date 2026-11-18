# Guía Rápida: Deploy a Vercel

## ⚡ Deploy Rápido (Opción 1: CLI)

```bash
# 1. Instalar Vercel CLI (solo la primera vez)
npm i -g vercel

# 2. Verificar que todo esté listo
npm run pre-deploy

# 3. Deploy a Vercel
vercel

# 4. Deploy a producción
vercel --prod
```

## 🌐 Deploy desde Git (Opción 2: Recomendado)

### Primera vez:

1. **Push tu código a GitHub/GitLab/Bitbucket**
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push
   ```

2. **Ir a Vercel**
   - Ve a [vercel.com/new](https://vercel.com/new)
   - Conecta tu cuenta de GitHub/GitLab/Bitbucket
   - Selecciona tu repositorio `gravity`

3. **Configurar el proyecto**

   Vercel detectará automáticamente que es Vite. Verifica estos settings:

   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
   - **Root Directory**: `./`

4. **⚠️ IMPORTANTE: Agregar Variables de Entorno**

   En "Environment Variables", agrega:

   ```
   VITE_SUPABASE_URL = tu_supabase_url_aquí
   VITE_SUPABASE_ANON_KEY = tu_supabase_anon_key_aquí
   VITE_AFIP_API_URL = tu_afip_api_url_aquí (opcional)
   ```

   **¿Dónde encontrar estos valores?**
   - Están en tu archivo `.env.local` local
   - O en tu dashboard de Supabase: Settings > API

5. **Deploy** 🚀
   - Click en "Deploy"
   - Espera 1-2 minutos
   - ¡Listo!

### Deploys posteriores:

Cada vez que hagas `git push` a la rama principal, Vercel desplegará automáticamente.

## 🧪 Testing Post-Deploy

Después del deploy, prueba estas URLs directamente (no desde navegación interna):

```
https://tu-proyecto.vercel.app/
https://tu-proyecto.vercel.app/pos
https://tu-proyecto.vercel.app/products
https://tu-proyecto.vercel.app/orders
https://tu-proyecto.vercel.app/orders/new
https://tu-proyecto.vercel.app/customers
```

**Todas deberían cargar correctamente sin errores 404.**

## 🔧 Configuración Incluida

El proyecto ya incluye:

- ✅ `vercel.json` - Configuración de rewrites para SPA routing
- ✅ `.vercelignore` - Archivos a ignorar en el deploy
- ✅ Headers de seguridad automáticos
- ✅ Cache optimizado para assets estáticos (1 año)
- ✅ Soporte completo para todas las rutas de React Router

## 🐛 Troubleshooting

### Error: "404 on page refresh"
**Solución**: Ya está resuelto con `vercel.json`. Si persiste:
- Verifica que `vercel.json` esté en el root del proyecto
- Revisa que el deploy haya incluido el archivo

### Error: "Supabase connection failed"
**Solución**:
- Verifica las variables de entorno en Vercel Dashboard
- Asegúrate de que empiecen con `VITE_`
- Re-deploy después de agregar las variables

### Error: Build fails
**Solución**:
```bash
# Testea el build localmente primero
npm run build

# Si hay errores de TypeScript, corrígelos primero
npm run lint
```

### Assets (CSS/JS) no cargan
**Solución**:
- Verifica que el `base` en `vite.config.ts` sea correcto
- Si despliegas en un subdirectorio, actualiza el `base`

## 📊 Monitoreo

Vercel te da acceso a:
- **Analytics**: Visitas, performance, etc.
- **Logs**: Runtime y build logs
- **Domains**: Conecta tu dominio personalizado
- **Environment Variables**: Gestión de secretos

Accede desde: https://vercel.com/dashboard

## 🔄 Rollback

Si algo sale mal, puedes hacer rollback:

1. Ve a tu proyecto en Vercel Dashboard
2. Click en "Deployments"
3. Encuentra el deployment anterior que funcionaba
4. Click en "..." > "Promote to Production"

## 📚 Más Info

- [Documentación de Vercel](https://vercel.com/docs)
- [Vite en Vercel](https://vercel.com/docs/frameworks/vite)
- [Variables de Entorno](https://vercel.com/docs/concepts/projects/environment-variables)
