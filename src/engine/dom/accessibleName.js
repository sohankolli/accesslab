// engine/dom/accessibleName.js
// Simplified version of the W3C "Accessible Name and Description
// Computation" (accname). Covers the cases AccessLab's rules need.

const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Text a screen reader would read from an element's descendants. */
function subtreeText(node) {
  let out = '';
  for (const child of node.childNodes) {
    if (child.nodeType === 3) out += child.textContent;
    else if (child.nodeType === 1) {
      if (child.getAttribute('aria-hidden') === 'true' || child.hidden) continue;
      if (child.tagName === 'IMG') out += ' ' + (child.getAttribute('alt') ?? '') + ' ';
      else out += ' ' + (child.getAttribute('aria-label') ?? subtreeText(child)) + ' ';
    }
  }
  return out;
}

export function accessibleName(el) {
  const doc = el.ownerDocument;

  // 1. aria-labelledby (space-separated id list)
  const ids = el.getAttribute('aria-labelledby');
  if (ids) {
    const text = clean(
      ids
        .split(/\s+/)
        .map((id) => doc.getElementById(id)?.textContent)
        .join(' '),
    );
    if (text) return text;
  }

  // 2. aria-label
  const label = clean(el.getAttribute('aria-label'));
  if (label) return label;

  // 3. Native labelling
  if (el.labels && el.labels.length) {
    const text = clean([...el.labels].map(subtreeText).join(' '));
    if (text) return text;
  }
  if (el.tagName === 'IMG') return clean(el.getAttribute('alt')); // alt="" => decorative
  if (el.tagName === 'INPUT' && ['submit', 'button', 'reset'].includes(el.type)) {
    // Browsers label value-less submit and reset buttons "Submit" and "Reset".
    return clean(el.value) || { submit: 'Submit', reset: 'Reset' }[el.type] || '';
  }

  // 4. Name from content (buttons, links, headings)
  if (/^(BUTTON|A|H[1-6]|SUMMARY)$/.test(el.tagName) || el.getAttribute('role') === 'button') {
    const text = clean(subtreeText(el));
    if (text) return text;
  }

  // 5. Fallbacks (weak; rules report these as warnings)
  return clean(el.getAttribute('title')) || clean(el.getAttribute('placeholder'));
}
