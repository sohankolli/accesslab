// engine/color/contrast.js
// WCAG 2.x relative luminance and contrast ratio.

/** Parse "rgb(r, g, b)" / "rgba(r, g, b, a)" as returned by getComputedStyle. */
export function parseColor(str) {
  const m = /rgba?\(([^)]+)\)/.exec(str ?? '');
  if (!m) return null;
  const [r, g, b, a = 1] = m[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);
  return { r, g, b, a };
}

/** Convert one 0–255 sRGB channel to linear light. */
function linear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance({ r, g, b }) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Alpha-composite a (possibly translucent) colour over an opaque one. */
export function blend(top, bottom) {
  const a = top.a ?? 1;
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  };
}

/** WCAG "large text": >= 18pt (24px), or >= 14pt (~18.66px) and bold. */
export function requiredRatio(fontSizePx, fontWeight) {
  const large = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
  return large ? 3 : 4.5;
}
