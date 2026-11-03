// Packs the app's shared feature files (src/engine/ml/graph.js and
// nodeFeatures.js) into one script that can be evaluated inside a crawled page.
// Nothing is copied by hand: the crawler always runs the app's current code.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ML_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/engine/ml');
const read = (name) => fs.readFileSync(path.join(ML_DIR, name), 'utf8');

/** Drop ES module syntax so the two files run as one plain function body. */
const unmodule = (code) =>
  code.replace(/^import [^;]+;\s*$/gm, '').replace(/^export (?=const|function|let|class)/gm, '');

/**
 * A function expression, as source text, that returns the feature API:
 * `(${FEATURE_SOURCE})()` gives {extractRows, isStructuralCandidate, ...}.
 */
export const FEATURE_SOURCE = `function () {
${unmodule(read('graph.js'))}
${unmodule(read('nodeFeatures.js'))}
return { extractRows, isStructuralCandidate, isCandidate, nodeFeatures, propagate, NODE_DIM, ROW_DIM };
}`;
