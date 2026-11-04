// The 92 per-element features, which elements are candidates, and the feature
// rows the model reads.
//
// Shared with the crawler (ml/crawler), which injects this file and graph.js
// into a script-free copy of each page it labels. It must therefore import only
// graph.js and use only standard DOM APIs, so the same code runs in the browser
// preview, in Chromium during crawling, and in jsdom during tests.
import { HASH_BUCKETS, propagate, tokenVector } from './graph.js';

/** One-hot tag slots. The last slot, OTHER, takes every tag not listed. */
export const TAGS = [
  'DIV',
  'SPAN',
  'LI',
  'A',
  'BUTTON',
  'IMG',
  'SVG',
  'I',
  'P',
  'TD',
  'INPUT',
  'UL',
  'NAV',
  'HEADER',
  'LABEL',
  'OTHER',
];

/** Style and structure features, in row order after the tag slots. */
export const DENSE = [
  'native control',
  'control role',
  'tabindex',
  'pointer cursor',
  'inline on… attribute',
  'text length',
  'child count',
  'icon inside',
  'background colour',
  'rounded corners',
  'area',
  'user-select: none',
];

/** Values per element: 16 tag slots, 12 style and structure values, 64 class-word buckets. */
export const NODE_DIM = TAGS.length + DENSE.length + HASH_BUCKETS;
/** Values per feature row: six neighbourhood views of NODE_DIM each. */
export const ROW_DIM = NODE_DIM * 6;

/** Where each group of features starts inside one view. */
export const OFFSETS = {
  tag: 0,
  dense: TAGS.length,
  words: TAGS.length + DENSE.length,
};

/** Elements that are already controls: keyboard and screen readers handle them. */
export const NATIVE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  'label',
  'audio[controls]',
  'video[controls]',
  '[contenteditable=""]',
  '[contenteditable="true"]',
].join(',');

/** Roles that make an element an announced control. */
export const CONTROL_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'switch',
  'tab',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'treeitem',
  'gridcell',
  'slider',
  'spinbutton',
  'combobox',
  'textbox',
  'searchbox',
  'listbox',
  'scrollbar',
]);

const ROLE_SELECTOR = [...CONTROL_ROLES].map((r) => `[role="${r}"]`).join(',');
const CONTROL_SELECTOR = `${NATIVE_SELECTOR},${ROLE_SELECTOR}`;

/** Tags that are never candidates: not drawn, structural, or handled elsewhere. */
const SKIP_TAGS = new Set([
  'HTML',
  'HEAD',
  'BODY',
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'LINK',
  'META',
  'TITLE',
  'BASE',
  'BR',
  'HR',
  'WBR',
  'SOURCE',
  'TRACK',
  'PARAM',
  'OPTION',
  'OPTGROUP',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'CANVAS',
]);

/**
 * Landmarks and other page regions. They hold controls but are never a
 * click-only control themselves; a click listener on one handles clicks for
 * the elements inside it.
 */
export const LANDMARK_TAGS = new Set([
  'MAIN',
  'HEADER',
  'FOOTER',
  'NAV',
  'ASIDE',
  'FORM',
  'SEARCH',
  'SECTION',
]);
export const LANDMARK_ROLES = new Set([
  'main',
  'navigation',
  'banner',
  'contentinfo',
  'complementary',
  'search',
  'form',
  'region',
]);

/**
 * True for a landmark or page region, by tag or by its first role.
 * @param {string} tag  tag name, any case
 * @param {string|null} role  the role attribute
 */
export function isLandmark(tag, role) {
  const first = (role || '').trim().split(/\s+/)[0].toLowerCase();
  return LANDMARK_TAGS.has(tag.toUpperCase()) || LANDMARK_ROLES.has(first);
}

/**
 * The same rule for stored markup that starts with an element's start tag
 * (the crawl's snippets), so the training data can be filtered exactly as the
 * app picks candidates. A role cut off by a truncated snippet is not seen.
 * @param {string} html
 */
export function isLandmarkMarkup(html) {
  const m = /^<([a-zA-Z][\w-]*)([^>]*)/.exec(html || '');
  if (!m) return false;
  const role = /\srole\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[2]);
  return isLandmark(m[1], role ? (role[1] ?? role[2] ?? role[3]) : null);
}

const upperTag = (el) => el.tagName.toUpperCase();

/** True when the element is a native control or has a control role. */
export function isControl(el) {
  return el.matches(CONTROL_SELECTOR);
}

/**
 * Structural candidacy, which does not depend on styles: the element is not a
 * control, not inside one, not a skipped tag, not a landmark or page region,
 * and not a part of an SVG drawing.
 * The crawler labels exactly these elements in the live page.
 */
export function isStructuralCandidate(el) {
  if (SKIP_TAGS.has(upperTag(el))) return false;
  if (isLandmark(el.tagName, el.getAttribute('role'))) return false;
  if (el.ownerSVGElement) return false; // <path>, <g>…: the <svg> itself is the candidate
  if (isControl(el)) return false;
  if (el.parentElement?.closest(CONTROL_SELECTOR)) return false;
  return true;
}

/** True when the element is drawn with a non-zero box. */
export function isVisible(el) {
  const win = el.ownerDocument.defaultView;
  const style = win.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (typeof el.checkVisibility === 'function' && style.display !== 'contents') {
    if (!el.checkVisibility({ visibilityProperty: true })) return false;
  } else {
    for (let node = el.parentElement; node; node = node.parentElement) {
      if (win.getComputedStyle(node).display === 'none') return false;
    }
  }
  const r = el.getBoundingClientRect();
  // jsdom has no layout and reports 0×0 for everything: trust the styles there.
  const noLayout = /jsdom/i.test(win.navigator?.userAgent ?? '');
  return noLayout || (r.width > 0 && r.height > 0);
}

/** A candidate: an element that could be a hidden, click-only control. */
export function isCandidate(el) {
  return isStructuralCandidate(el) && isVisible(el);
}

const transparent = (c) => !c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c);

/**
 * The 92 features of one element, before neighbourhood propagation.
 * @param {Element} el
 * @returns {Float32Array} NODE_DIM values
 */
export function nodeFeatures(el) {
  const out = new Float32Array(NODE_DIM);
  const win = el.ownerDocument.defaultView;
  const s = win.getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const tag = upperTag(el);

  const slot = TAGS.indexOf(tag);
  out[slot >= 0 ? slot : TAGS.length - 1] = 1;

  const text = (el.textContent || '').trim();
  const role = (el.getAttribute('role') || '').trim().split(/\s+/)[0];
  const tabindex = el.getAttribute('tabindex');
  const dense = [
    el.matches(NATIVE_SELECTOR) ? 1 : 0,
    CONTROL_ROLES.has(role) ? 1 : 0,
    tabindex !== null && Number(tabindex) >= 0 ? 1 : 0,
    s.cursor === 'pointer' ? 1 : 0,
    [...el.attributes].some((a) => /^on[a-z]+$/.test(a.name)) ? 1 : 0,
    Math.min(Math.log1p(text.length) / 6, 1),
    Math.min(el.children.length, 20) / 20,
    el.querySelector('img, svg, i') ? 1 : 0,
    transparent(s.backgroundColor) && s.backgroundImage === 'none' ? 0 : 1,
    parseFloat(s.borderTopLeftRadius) > 0 ? 1 : 0,
    Math.min(Math.log1p(r.width * r.height) / 15, 1),
    s.userSelect === 'none' || s.webkitUserSelect === 'none' ? 1 : 0,
  ];
  out.set(dense, OFFSETS.dense);
  out.set(tokenVector(el), OFFSETS.words);
  return out;
}

/**
 * Feature rows for every candidate in a document.
 * @param {Document} doc  a rendered document (the preview, or a crawled snapshot)
 * @param {{maxNodes?: number, maxCandidates?: number}} [limits]
 *   Very large pages are cut at maxNodes elements and maxCandidates candidates,
 *   in document order; `truncated` says when that happened.
 * @returns {{candidates: Element[], rows: Float32Array[], truncated: boolean}}
 */
export function extractRows(doc, { maxNodes = 8000, maxCandidates = 3000 } = {}) {
  const all = doc.body ? doc.body.querySelectorAll('*') : [];
  const nodes = Array.prototype.slice.call(all, 0, maxNodes);
  let truncated = all.length > maxNodes;
  const X = nodes.map(nodeFeatures);
  const picked = [];
  for (let i = 0; i < nodes.length; i++) {
    if (isCandidate(nodes[i])) {
      if (picked.length === maxCandidates) {
        truncated = true;
        break;
      }
      picked.push(i);
    }
  }
  return {
    candidates: picked.map((i) => nodes[i]),
    rows: propagate(nodes, X, picked),
    truncated,
  };
}
