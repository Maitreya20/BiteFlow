import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Move third-party libraries used everywhere into one vendor chunk.
          if (id.includes('node_modules')) {
            // Keep react + router on the initial chunk (shell needs them). Move
            // the rest into a vendor chunk to keep the initial payload smaller.
            if (id.includes('react-dom') || id.includes('react-router-dom')) {
              return undefined
            }
            return 'chunk-vendor'
          }

          // Split feature code by route surface. This keeps the first paint
          // payload small and avoids a single giant app chunk.
          if (id.includes('src/components/layout/DashboardShell')) {
            return 'chunk-shell'
          }
          if (id.includes('src/pages/app')) {
            return 'chunk-app'
          }
          if (id.includes('src/pages/admin')) {
            return 'chunk-admin'
          }
          if (id.includes('src/pages/customer')) {
            return 'chunk-customer'
          }
          if (id.includes('src/pages/marketing')) {
            return 'chunk-marketing'
          }
          if (id.includes('src/pages/auth')) {
            return 'chunk-auth'
          }
          if (id.includes('src/pages/onboarding')) {
            return 'chunk-onboarding'
          }

          return undefined
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
})
