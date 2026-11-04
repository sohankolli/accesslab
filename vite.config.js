import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['onnxruntime-web/wasm'],
  },
  resolve: {
    alias: {
      // The model worker uses ONNX Runtime's build that loads its WebAssembly
      // from ort.env.wasm.wasmPaths (/ort/, copied by scripts/copy-ort-wasm.mjs)
      // instead of bundling a second 14 MB copy into assets/.
      'onnxruntime-web/wasm': fileURLToPath(
        new URL('./node_modules/onnxruntime-web/dist/ort.wasm.min.mjs', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
    },
  },
});
