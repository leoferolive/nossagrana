import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'NossaGrana',
        short_name: 'NossaGrana',
        description: 'PWA de gestão financeira familiar',
        theme_color: '#F2F4EF',
        background_color: '#F2F4EF',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // Só o subconjunto latino da fonte entra no cache offline; os demais o navegador nem baixa em pt-BR.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}', '**/manrope-latin-wght-normal-*.woff2'],
        // Endereços internos (/mais/categorias, /planejar/...) caem no index.html pelo service worker, para
        // abrir offline. /api e /health são do servidor: nunca podem responder como navegação.
        navigateFallbackDenylist: [/^\/api\//, /^\/health/],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
