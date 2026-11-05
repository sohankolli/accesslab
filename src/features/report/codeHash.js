/**
 * A short fingerprint of a page's code, saved with each run so the history can
 * tell "the same code checked again" (a refresh, or coming back to the
 * workbench) from a real edit.
 *
 * Why this hash: FNV-1a (32-bit) is a few lines of plain JavaScript, needs no
 * library and no async Web Crypto call, and hashes a 500 KB page in a few
 * milliseconds. It is not cryptographic, and does not need to be: a rare
 * collision only means one edit is not recorded as a new run, and the score
 * must also match (see historySlice.js).
 * @param {string} html
 * @param {string} css
 * @returns {string} 8 hex digits
 */
export function codeHash(html, css) {
  // The separator keeps "<p>a</p>" + "" apart from "<p>a</p" + ">".
  const text = `${html}\u0000${css}`;
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime, kept to 32 bits
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
