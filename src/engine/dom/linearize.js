// Produce the sequence a screen reader would announce in browse mode.
import { accessibleName } from './accessibleName.js';
import { roleOf } from './roles.js';

/** Roles announced with a start and an end line around their content. */
const LANDMARKS = new Set(['navigation', 'main', 'banner', 'contentinfo', 'form', 'list', 'table']);
const LEAVES = new Set([
  'heading',
  'link',
  'button',
  'img',
  'textbox',
  'searchbox',
  'checkbox',
  'radio',
  'combobox',
  'listbox',
  'slider',
]); // name already covers children
/** Elements never read: their text is code, not content. */
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT']);

/**
 * @typedef {object} SpokenLine
 * @property {string} role  the role announced ('text' for plain text)
 * @property {string} text  what is read, e.g. "heading level 2, Menu" or "main start"
 * @property {boolean} [missing]  true when a control or image has no accessible name
 */

/**
 * Produce what a screen reader announces in browse mode, in page order
 * (design doc Listing 15). Landmarks are announced on entry and exit,
 * headings with their level, controls and images as "role, name", and text
 * as it appears. Content hidden from assistive technology (hidden,
 * aria-hidden="true", decorative alt="" images) is skipped. A missing name
 * reads "(no name)" and sets missing: true.
 * @param {Document|Element} root  a document (read from its <body>) or an element
 * @returns {SpokenLine[]}
 */
export function linearize(root) {
  const lines = [];
  const walk = (node) => {
    if (node.nodeType === 3) {
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (text) lines.push({ role: 'text', text });
      return;
    }
    if (node.nodeType !== 1 || SKIP.has(node.tagName)) return;
    if (node.hidden || node.getAttribute('aria-hidden') === 'true') return;

    const role = roleOf(node);
    if (role === 'presentation' || role === 'none') {
      if (node.tagName === 'IMG') return; // decorative image: silent
    } else if (LEAVES.has(role)) {
      const name = accessibleName(node);
      const level =
        role === 'heading'
          ? ` level ${node.getAttribute('aria-level') ?? /^H(\d)$/.exec(node.tagName)?.[1] ?? 2}`
          : '';
      lines.push({ role, text: `${role}${level}, ${name || '(no name)'}`, missing: !name });
      return;
    } else if (LANDMARKS.has(role)) {
      lines.push({ role, text: `${role} start` });
      node.childNodes.forEach(walk);
      lines.push({ role, text: `${role} end` });
      return;
    }
    node.childNodes.forEach(walk);
  };
  // A Document is node type 9, which walk() would ignore: start at its <body>.
  walk(root.nodeType === 9 ? root.body : root);
  return lines;
}
