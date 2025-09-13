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
        name: 'PreSub',
        short_name: 'PreSub',
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
  base: "/PreSub/",
  build: {
    rollupOptions: {
      output: {
        // Split heavy dependencies into dedicated chunks for better caching and smaller initial loads
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'vendor-react';
            if (id.includes('pdfjs-dist')) return 'vendor-pdf';
            if (id.includes('xlsx') || id.includes('mammoth')) return 'vendor-office';
            if (id.includes('exifreader') || id.includes('jszip')) return 'vendor-media';
            // Fallback: group other node_modules into a shared vendor chunk
            return 'vendor';
          }
        },
      },
    },
    // Raise the limit to reduce noisy warnings while keeping an eye on bundle sizes
    chunkSizeWarningLimit: 1000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
