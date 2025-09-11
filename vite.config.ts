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
      injectRegister: 'auto',
      minify: false,
      includeAssets: ['vite.svg'],
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        name: 'Manuscript Anonymity Scanner',
        short_name: 'AnonScan',
        description: 'Scan documents for anonymity before submission.',
        display: 'standalone',
        background_color: '#ffffff',
        start_url: '.',
        theme_color: '#ffffff',
        icons: [
          // Use local SVG icon; good for desktop install.
          // For Android/iOS, adding PNG 192/512 is recommended.
          {
            src: '/vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
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
