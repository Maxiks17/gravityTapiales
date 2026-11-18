import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // Escuchar en todas las interfaces de red (0.0.0.0)
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks - librerías grandes separadas
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'ui-vendor': ['lucide-react', 'date-fns'],
          'pdf-vendor': ['jspdf', 'jspdf-autotable'],
          'radix-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-separator', 
            '@radix-ui/react-slot',
            '@radix-ui/react-tooltip'
          ],
        },
      },
    },
    chunkSizeWarningLimit: 600, // Aumentar el límite a 600kb
  },
})
