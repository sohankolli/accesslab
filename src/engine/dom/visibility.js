// Is an element actually rendered and visible?

/**
 * True when the element is drawn on screen: not display:none itself or through
 * an ancestor (e.g. inside <div hidden>), and not visibility:hidden.
 * Browsers answer this with checkVisibility(); where it is missing (jsdom), or
 * for display:contents (no box of its own, so checkVisibility says false), we
 * walk the ancestors instead.
 */
export function isRendered(el) {
  const win = el.ownerDocument.defaultView;
  const style = win.getComputedStyle(el);
  if (typeof el.checkVisibility === 'function' && style.display !== 'contents') {
    return el.checkVisibility({ visibilityProperty: true });
  }
  if (style.visibility === 'hidden') return false; // inherited, so this covers ancestors too
  for (let node = el; node; node = node.parentElement) {
    if (win.getComputedStyle(node).display === 'none') return false;
  }
  return true;
}
