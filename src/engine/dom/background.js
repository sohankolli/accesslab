// engine/dom/background.js
// Work out the colour actually painted behind an element's text.
import { parseColor, blend } from '../color/contrast.js';

const CANVAS = { r: 255, g: 255, b: 255, a: 1 }; // default page background

export function effectiveBackground(el) {
  const win = el.ownerDocument.defaultView;
  const layers = [];
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const style = win.getComputedStyle(node);
    if (style.backgroundImage && style.backgroundImage !== 'none') {
      return null; // gradient/image: cannot be computed, flag for manual review
    }
    const c = parseColor(style.backgroundColor);
    if (c && c.a > 0) {
      layers.push(c);
      if (c.a === 1) break; // fully opaque: nothing below is visible
    }
  }
  // Composite from the outermost layer inwards.
  return layers.reduceRight((acc, layer) => blend(layer, acc), CANVAS);
}
