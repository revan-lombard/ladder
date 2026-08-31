import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Deployed to GitHub Pages under /ladder/ — base, scope and start_url must agree.
export default defineConfig({
  base: '/ladder/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Precache the app shell only. Supabase requests must NEVER be
        // cache-served — financial data may not be stale. No runtime caching
        // rule for *.supabase.co means workbox leaves those requests alone.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/ladder/index.html',
      },
      manifest: {
        name: 'LADDER',
        short_name: 'LADDER',
        description: 'Build the life you want. One rung at a time.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/ladder/',
        start_url: '/ladder/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
