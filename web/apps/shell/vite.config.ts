import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig({
  server: { port: 5173 },
  plugins: [
    react(),
    federation({
      remotes: {
        mf_spectrogram: "http://localhost:5176/assets/remoteEntry.js",
      },
      shared: {
        react: { singleton: true, eager: true },
        "react-dom": { singleton: true, eager: true },
      },
    }),
  ],
  build: { target: "esnext", modulePreload: false, minify: false },
  test: {
    environment: "jsdom",
    coverage: { provider: "v8", reporter: ["text", "html"] },
  },
});
