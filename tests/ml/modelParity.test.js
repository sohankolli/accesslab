// @vitest-environment node
// The browser runtime gives the same probabilities as PyTorch did at export,
// for 50 stored rows from the test websites (written by ml/train/train.py).
import { it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as ort from 'onnxruntime-web';
import { ROW_DIM } from '../../src/engine/ml/nodeFeatures';

const here = import.meta.dirname;
const fixture = JSON.parse(fs.readFileSync(path.join(here, 'fixtures/clickables-parity.json')));
const model = fs.readFileSync(path.join(here, '../../public/models/clickables-v1.onnx'));

it('matches PyTorch to within 1e-5 on 50 stored inputs', async () => {
  const session = await ort.InferenceSession.create(model);
  const n = fixture.inputs.length;
  expect(n).toBe(50);
  const x = new ort.Tensor('float32', Float32Array.from(fixture.inputs.flat()), [n, ROW_DIM]);
  const { p } = await session.run({ x });
  const diff = Math.max(...fixture.outputs.map((v, i) => Math.abs(v - p.data[i])));
  expect(diff).toBeLessThan(1e-5);
});
