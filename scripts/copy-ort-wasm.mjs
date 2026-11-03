// Copies ONNX Runtime Web's WebAssembly runtime (the .wasm and its .mjs loader) into public/ort/, so the app serves
// it itself. By default the runtime fetches it from a public CDN, which the
// Content Security Policy blocks. Runs before `dev` and `build`; the copy is not
// committed (it is 14 MB and comes from node_modules).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const from = path.join(root, 'node_modules/onnxruntime-web/dist');
const to = path.join(root, 'public/ort');
const FILES = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'];

fs.mkdirSync(to, { recursive: true });
for (const file of FILES) {
  const src = path.join(from, file);
  if (!fs.existsSync(src)) {
    console.error(`copy-ort-wasm: ${src} is missing. Run npm install.`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(to, file));
}
console.log(`copy-ort-wasm: ${FILES.join(', ')} -> public/ort/`);
