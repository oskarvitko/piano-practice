import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/piano-practice/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'audio/piano/*', 'audio/voice/**/*'],
      manifest: {
        name: 'Piano Practice — твоя ежедневная практика',
        short_name: 'Piano Practice',
        description: 'Гаммы, паттерны и импровизация. 16 недель за пианино.',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#101827',
        background_color: '#101827',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,mp3,wav,txt,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    clearMocks: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          audio: ['tone'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
          database: ['dexie', 'zod'],
        },
      },
    },
  },
});
