import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// Cesium is loaded at runtime from /cesium/Cesium.js (copied from the npm package
// by scripts/copy-cesium.mjs) so that its Workers/Assets resolve correctly and the
// app bundle stays small. See src/services/cesium/loader.ts.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
