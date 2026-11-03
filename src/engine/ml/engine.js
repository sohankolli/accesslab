// The model runner, independent of where it runs: the Web Worker wraps it for
// the app, and tests drive it directly in Node.
import { MANIFEST_URL, MODEL_BASE, validateManifest } from './manifest.js';
import { ROW_DIM } from './nodeFeatures.js';

/**
 * @param {{
 *   ort: typeof import('onnxruntime-web'),
 *   fetchFn?: typeof fetch,
 *   manifestUrl?: string, modelBase?: string,
 * }} deps
 */
export function createEngine({
  ort,
  fetchFn = fetch,
  manifestUrl = MANIFEST_URL,
  modelBase = MODEL_BASE,
}) {
  let session = null;
  let manifest = null;

  return {
    /** Load and check the manifest, then the model. Rejects with a plain message. */
    async load() {
      const res = await fetchFn(manifestUrl);
      if (!res.ok) throw new Error(`The model manifest could not be loaded (HTTP ${res.status}).`);
      manifest = validateManifest(await res.json());
      const model = await fetchFn(modelBase + manifest.model);
      if (!model.ok) throw new Error(`The model file could not be loaded (HTTP ${model.status}).`);
      const bytes = new Uint8Array(await model.arrayBuffer());
      session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
      return manifest;
    },

    /**
     * Probabilities for n feature rows.
     * @param {Float32Array} flat  n × ROW_DIM values, row after row
     * @returns {Promise<{p: Float32Array, ms: number}>}
     */
    async score(flat) {
      if (!session) throw new Error('The model is not loaded.');
      if (flat.length % ROW_DIM !== 0) {
        throw new Error(`Expected a multiple of ${ROW_DIM} values, got ${flat.length}.`);
      }
      const n = flat.length / ROW_DIM;
      if (n === 0) return { p: new Float32Array(0), ms: 0 };
      const t0 = performance.now();
      const input = new ort.Tensor('float32', flat, [n, ROW_DIM]);
      const out = await session.run({ [manifest.input.name]: input });
      const p = Float32Array.from(out[manifest.output.name].data);
      input.dispose?.();
      return { p, ms: performance.now() - t0 };
    },
  };
}
