/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Manuscript Anonymity Scanner',
        short_name: 'AnonScan',
        description: 'Scan documents for anonymity before submission.',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'https://placehold.co/192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'https://placehold.co/512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
