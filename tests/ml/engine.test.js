// @vitest-environment node
// The model runner with the real ONNX Runtime and the real shipped model.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as ort from 'onnxruntime-web';
import { createEngine } from '../../src/engine/ml/engine';
import { FEATURE_VERSION } from '../../src/engine/ml/manifest';
import { ROW_DIM } from '../../src/engine/ml/nodeFeatures';

const PUBLIC = path.resolve(import.meta.dirname, '../../public');

/** fetch() over the public folder, with optional overrides per path. */
const fakeFetch =
  (overrides = {}) =>
  async (url) => {
    if (url in overrides) return overrides[url]();
    const file = path.join(PUBLIC, url);
    if (!fs.existsSync(file)) return new Response('missing', { status: 404 });
    return new Response(fs.readFileSync(file));
  };
const manifest = () => JSON.parse(fs.readFileSync(path.join(PUBLIC, 'models/clickables-v1.json')));

describe('model engine', () => {
  it('loads the shipped model and returns one probability per row', async () => {
    const engine = createEngine({ ort, fetchFn: fakeFetch() });
    const m = await engine.load();
    expect(m.featureVersion).toBe(FEATURE_VERSION);
    const rows = new Float32Array(3 * ROW_DIM);
    rows.fill(0.1, ROW_DIM, 2 * ROW_DIM);
    const { p, ms } = await engine.score(rows);
    expect(p).toHaveLength(3);
    expect([...p].every((v) => v >= 0 && v <= 1)).toBe(true);
    expect(ms).toBeGreaterThanOrEqual(0);
  });

  it('refuses a model trained on another feature layout', async () => {
    const other = { ...manifest(), featureVersion: 'clickables-features-0' };
    const engine = createEngine({
      ort,
      fetchFn: fakeFetch({ '/models/clickables-v1.json': () => Response.json(other) }),
    });
    await expect(engine.load()).rejects.toThrow(/expects features "clickables-features-0"/);
  });

  it('fails with a plain message when the model file is missing', async () => {
    const engine = createEngine({
      ort,
      fetchFn: fakeFetch({ '/models/clickables-v1.onnx': () => new Response('', { status: 404 }) }),
    });
    await expect(engine.load()).rejects.toThrow('The model file could not be loaded (HTTP 404).');
  });

  it('rejects rows of the wrong length', async () => {
    const engine = createEngine({ ort, fetchFn: fakeFetch() });
    await engine.load();
    await expect(engine.score(new Float32Array(ROW_DIM + 1))).rejects.toThrow(/multiple of 552/);
  });
});
