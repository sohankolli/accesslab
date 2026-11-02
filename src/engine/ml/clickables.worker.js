// Web Worker: loads the click-only controls model and scores feature rows off
// the main thread, so typing in the editor never waits for the model.
//
// Messages in:  {type: 'load'}  ·  {type: 'score', id, rows: Float32Array}
// Messages out: {type: 'ready', manifest}  ·  {type: 'unavailable', message}
//               {type: 'scores', id, p: Float32Array, ms}  ·  {type: 'failed', id, message}
import * as ort from 'onnxruntime-web/wasm';
import { createEngine } from './engine.js';

// The WebAssembly runtime is served by AccessLab itself (copied into public/ort
// by scripts/copy-ort-wasm.mjs): the default public CDN is blocked by the
// Content Security Policy. One thread, because threads need cross-origin
// isolation, which the app does not enable.
ort.env.wasm.wasmPaths = {
  wasm: '/ort/ort-wasm-simd-threaded.wasm',
};
ort.env.wasm.numThreads = 1;

const engine = createEngine({ ort });
let loading = null;

self.onmessage = async ({ data }) => {
  if (data.type === 'load') {
    loading ??= engine.load();
    try {
      self.postMessage({ type: 'ready', manifest: await loading });
    } catch (err) {
      self.postMessage({ type: 'unavailable', message: err?.message || String(err) });
    }
  } else if (data.type === 'score') {
    try {
      const { p, ms } = await engine.score(data.rows);
      self.postMessage({ type: 'scores', id: data.id, p, ms }, [p.buffer]);
    } catch (err) {
      self.postMessage({ type: 'failed', id: data.id, message: err?.message || String(err) });
    }
  }
};
