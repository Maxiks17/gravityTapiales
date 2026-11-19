# Deployment Guide

## SPA Routing Configuration

This application uses React Router with BrowserRouter, which requires server-side configuration to handle direct URL access.

### The Problem

When you navigate within the app (clicking links), React Router handles the routing client-side and everything works. However, when you refresh the page or enter a URL directly (like `/pos`), the server tries to find that file and returns a 404 error.

### The Solution

The server needs to redirect all requests to `index.html`, allowing React Router to handle the routing.

## Development Server

Vite's development server (`npm run dev`) automatically handles SPA routing. If you experience issues:

```bash
# Clear Vite cache and restart
rm -rf node_modules/.vite
npm run dev
```

## Production Deployment

Choose the configuration that matches your hosting platform:

### Netlify

Already configured! The `public/_redirects` file handles routing automatically.

### Vercel

Already configured! The `vercel.json` file handles routing automatically.

**Deployment Steps:**

1. **Install Vercel CLI** (optional, pero recomendado):
   ```bash
   npm i -g vercel
   ```

2. **Deploy desde la terminal**:
   ```bash
   vercel
   ```

3. **O conecta tu repositorio Git**:
   - Ve a [vercel.com](https://vercel.com)
   - Importa tu repositorio de GitHub/GitLab/Bitbucket
   - Vercel detectará automáticamente que es un proyecto Vite
   - Los settings de build serán:
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`
     - **Install Command**: `npm install`

4. **Variables de entorno** (IMPORTANTE):
   En el dashboard de Vercel, agrega estas variables de entorno:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `VITE_AFIP_API_URL` (si usas AFIP)

**Características incluidas en vercel.json:**
- ✅ Reescritura de rutas para SPA
- ✅ Cache de assets estáticos (1 año)
- ✅ Headers de seguridad (XSS, clickjacking, etc.)

**Testing después del deploy:**
```bash
# Si usaste Vercel CLI
vercel --prod

# Luego prueba estas URLs directamente:
# https://tu-proyecto.vercel.app/
# https://tu-proyecto.vercel.app/pos
# https://tu-proyecto.vercel.app/products
```

### Apache

The `public/.htaccess` file will be copied to the build output automatically. Make sure:

1. `mod_rewrite` is enabled
2. `.htaccess` files are allowed (`AllowOverride All`)

### Nginx

Use the provided `nginx.conf` as a reference. Update your nginx configuration:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### Other Servers

**Node.js (Express)**:
```javascript
const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(3000);
```

**Docker with Nginx**:
```dockerfile
FROM nginx:alpine
COPY dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Build and Preview

```bash
# Build for production
npm run build

# Preview the production build locally
npm run preview
```

The preview server is configured to handle SPA routing correctly.

## Testing Direct URL Access

After deploying, test these URLs directly in your browser:

- `https://yourdomain.com/`
- `https://yourdomain.com/pos`
- `https://yourdomain.com/products`
- `https://yourdomain.com/orders/new`

All should load without 404 errors.

## Troubleshooting

### Still getting 404 errors?

1. **Check server configuration**: Ensure the redirect rules are active
2. **Clear browser cache**: Hard refresh with Ctrl+Shift+R (or Cmd+Shift+R on Mac)
3. **Check build output**: Ensure `dist/index.html` exists
4. **Verify base path**: If deploying to a subdirectory, update `vite.config.ts`:
   ```typescript
   export default defineConfig({
     base: '/subdirectory/',
     // ...
   })
   ```

### Assets not loading?

Check that your `vite.config.ts` has the correct `base` setting for your deployment path.
