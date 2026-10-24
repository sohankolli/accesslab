// engine/color/suggest.js
// Find the nearest passing text colour by changing lightness only (hue kept).
import { contrastRatio } from './contrast.js';

export function rgbToHsl({ r, g, b }) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return { h: h / 6, s, l };
}

export function hslToRgb({ h, s, l }) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v, a: 1 };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: Math.round(hue(h + 1 / 3) * 255),
    g: Math.round(hue(h) * 255),
    b: Math.round(hue(h - 1 / 3) * 255),
    a: 1,
  };
}

export const toHex = ({ r, g, b }) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/**
 * Search outward from the current lightness in 1% steps, trying darker and
 * lighter alternately, and return the first colour that meets the target.
 */
export function suggestColor(fg, bg, target) {
  const { h, s, l } = rgbToHsl(fg);
  for (let step = 1; step <= 100; step++) {
    for (const dir of [-1, 1]) {
      const nl = l + (dir * step) / 100;
      if (nl < 0 || nl > 1) continue;
      const candidate = hslToRgb({ h, s, l: nl });
      if (contrastRatio(candidate, bg) >= target) return candidate;
    }
  }
  return null; // no lightness on this hue passes (rare)
}
