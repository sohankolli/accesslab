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

/**
 * What the manifest holds instead of a threshold (and the numbers that need
 * one) when no threshold reached the target precision on the calibration
 * websites. Suggestions then start at the manifest's operating threshold, if
 * it has one; otherwise the model runs but suggests nothing.
 */
export const NOT_REACHED = 'not reached';
export const MANIFEST_URL = `${MODEL_BASE}clickables-v1.json`;

const usableThreshold = (t) => typeof t === 'number' && t > 0 && t < 1;

/**
 * The probability at which the app makes a suggestion: the manifest's
 * operating threshold (chosen by a fixed rule in cross-validation), or, for
 * older manifests without one, the target-precision threshold.
 * @param {object} m  a valid manifest
 * @returns {number|null} null when the manifest has neither, so nothing is suggested
 */
export function suggestionThreshold(m) {
  if (m.operatingThreshold?.value === NOT_REACHED) return null;
  if (usableThreshold(m.operatingThreshold?.value)) return m.operatingThreshold.value;
  return usableThreshold(m.threshold) ? m.threshold : null;
}

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
  if (!usableThreshold(m.threshold) && m.threshold !== NOT_REACHED) {
    throw new Error('The model manifest has no usable threshold.');
  }
  const op = m.operatingThreshold;
  if (op != null && !usableThreshold(op.value) && op.value !== NOT_REACHED) {
    throw new Error('The model manifest has no usable operating threshold.');
  }
  return m;
}
