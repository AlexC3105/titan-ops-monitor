import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// TITAN web-pwa — Vite config.
// PWA: installable shell + offline app shell via vite-plugin-pwa (Workbox).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.svg'],
      manifest: {
        name: 'TITAN — Operational Intelligence Monitor',
        short_name: 'TITAN',
        description:
          'Live public weather and flight data, maps, and heuristic scenario planning.',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    // Local development only: OpenSky does not allow cross-origin browser
    // requests, so the dev server forwards /osky to it. Production builds call
    // the TITAN API Worker instead (see worker/ and src/services/adapters/openSkyFlights.ts).
    proxy: {
      '/osky': {
        target: 'https://opensky-network.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/osky/, ''),
      },
    },
  },
  // MapLibre is a legitimately large, lazy-loaded chunk; raise the warning ceiling.
  build: { chunkSizeWarningLimit: 1200 },
})
