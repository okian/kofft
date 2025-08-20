import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  server: { 
    port: 5175,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    fs: {
      allow: ['..']
    },
    middlewareMode: false
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@wasm': fileURLToPath(new URL('./wasm', import.meta.url)),
    },
  },
  plugins: [
    react(),
    federation({
      name: 'mf_spectrogram',
      filename: 'remoteEntry.js',
      exposes: {
        './remote': './src/index.tsx',
      },
      shared: {
        react: { singleton: true, eager: true, requiredVersion: '^18' },
        'react-dom': { singleton: true, eager: true, requiredVersion: '^18' },
      },
    }),
    {
      name: 'wasm-mime-type',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.includes('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          }
          next();
        });
      },
    },
  ],
  build: { target: 'esnext', modulePreload: false, minify: false },
})

