// The page as a graph, and every element's view of its neighbourhood.
//
// SIGN-style propagation (Frasca et al., 2020): neighbour aggregation is
// computed here, in plain JavaScript, so the network that runs in the browser
// is a small feed-forward model. The crawler injects this same file into the
// pages it labels, so training features and app features cannot drift apart.
// For that reason it imports nothing and uses only standard DOM APIs.

/** Number of buckets that class and id trigrams are hashed into. */
export const HASH_BUCKETS = 64;

/** The six views, in the order they are laid out in a feature row. */
export const VIEWS = ['self', 'parent', 'children', 'siblings', 'grandparent', 'grandchildren'];

/** FNV-1a, 32-bit: a small, fast, well-spread string hash. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** The lower-case words of an element's class and id ("btn-close" stays one word). */
export function classWords(el) {
  const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
  return `${cls} ${el.id || ''}`
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean);
}

/**
 * Character trigrams of the class and id words, hashed into HASH_BUCKETS and
 * scaled to unit length. "btn", "button" and "cta-btn" share trigrams, so they
 * land close together without a hand-made word list.
 * @returns {Float32Array}
 */
export function tokenVector(el) {
  const v = new Float32Array(HASH_BUCKETS);
  for (const word of classWords(el)) {
    const padded = `^${word}$`;
    for (let i = 0; i + 3 <= padded.length; i++) {
      v[fnv1a(padded.slice(i, i + 3)) % HASH_BUCKETS] += 1;
    }
  }
  let norm = 0;
  for (let k = 0; k < v.length; k++) norm += v[k] * v[k];
  norm = Math.sqrt(norm) || 1;
  for (let k = 0; k < v.length; k++) v[k] /= norm;
  return v;
}

/**
 * Give every node a view of its neighbourhood.
 * @param {Element[]} nodes  the graph's elements, in document order
 * @param {Float32Array[]} X  one per-element feature row per node, all the same length d
 * @param {number[]} [only]  indices of the nodes to build rows for (default: all)
 * @returns {Float32Array[]} rows of 6·d numbers:
 *   [self | parent | mean of children | mean of siblings | grandparent | mean of grandchildren].
 *   A missing neighbour (no parent, no children…) contributes zeros.
 */
export function propagate(nodes, X, only) {
  const d = X.length ? X[0].length : 0;
  const index = new Map(nodes.map((el, i) => [el, i]));
  const parentOf = nodes.map((el) => index.get(el.parentElement) ?? -1);
  const children = nodes.map(() => []);
  parentOf.forEach((p, i) => {
    if (p >= 0) children[p].push(i);
  });

  const meanInto = (out, offset, ids) => {
    if (!ids.length) return;
    for (const i of ids) {
      const row = X[i];
      for (let k = 0; k < d; k++) out[offset + k] += row[k];
    }
    for (let k = 0; k < d; k++) out[offset + k] /= ids.length;
  };

  const targets = only ?? nodes.map((_, i) => i);
  return targets.map((i) => {
    const out = new Float32Array(d * 6);
    const p = parentOf[i];
    out.set(X[i], 0);
    if (p >= 0) out.set(X[p], d);
    meanInto(out, 2 * d, children[i]);
    if (p >= 0) {
      meanInto(
        out,
        3 * d,
        children[p].filter((j) => j !== i),
      );
      if (parentOf[p] >= 0) out.set(X[parentOf[p]], 4 * d);
    }
    meanInto(
      out,
      5 * d,
      children[i].flatMap((c) => children[c]),
    );
    return out;
  });
}
