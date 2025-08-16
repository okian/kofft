import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  root: 'app',
  publicDir: 'app/public',
  resolve: {
    alias: {
      '@wasm': path.resolve(__dirname, './pkg/web_spectrogram.js')
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: 'tests/setup.ts'
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Kofft Spectrogram',
        short_name: 'Spectrogram',
        start_url: '.',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          {
            src: '/vinyl.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/vinyl.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ]
});
