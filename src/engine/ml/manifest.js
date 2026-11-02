// The model's manifest: which file to load, what it expects, and what it
// measured. Written by ml/train/train.py next to the model in public/models/.
import { ROW_DIM } from './nodeFeatures.js';

/**
 * The feature layout this app computes. A model trained on another layout
 * would read the numbers wrongly, so it is refused. Change it (here and in
 * ml/train/train.py) whenever nodeFeatures.js or graph.js changes what a row means.
 */
export const FEATURE_VERSION = 'clickables-features-1';

export const MODEL_BASE = '/models/';
export const MANIFEST_URL = `${MODEL_BASE}clickables-v1.json`;

/**
 * Check a manifest before its model is used.
 * @param {unknown} m  parsed JSON
 * @returns {object} the manifest
 * @throws {Error} with a plain message when the model cannot be used here
 */
export function validateManifest(m) {
  if (!m || typeof m !== 'object') throw new Error('The model manifest is not valid JSON.');
  if (m.featureVersion !== FEATURE_VERSION) {
    throw new Error(
      `The model expects features "${m.featureVersion}" but this app computes "${FEATURE_VERSION}".`,
    );
  }
  if (m.input?.dim !== ROW_DIM) {
    throw new Error(`The model expects ${m.input?.dim} values per element, not ${ROW_DIM}.`);
  }
  if (typeof m.model !== 'string' || !/^[\w.-]+\.onnx$/.test(m.model)) {
    throw new Error('The model manifest does not name an .onnx file.');
  }
  if (typeof m.threshold !== 'number' || m.threshold <= 0 || m.threshold >= 1) {
    throw new Error('The model manifest has no usable threshold.');
  }
  return m;
}
