// engine/rules/colorContrast.js
import { parseColor, contrastRatio, blend, requiredRatio } from '../color/contrast.js';
import { suggestColor, toHex } from '../color/suggest.js';
import { effectiveBackground } from '../dom/background.js';
import { cssPath } from '../dom/cssPath.js';
import { isRendered } from '../dom/visibility.js';
import { issue } from './basicRules.js';

const BLACK = { r: 0, g: 0, b: 0, a: 1 };

/** "white", "black", or the shortest hex: #999999 → "#999". */
export function colorName(rgb) {
  const hex = toHex(rgb);
  if (hex === '#ffffff') return 'white';
  if (hex === '#000000') return 'black';
  return /^#(.)\1(.)\2(.)\3$/.test(hex) ? `#${hex[1]}${hex[3]}${hex[5]}` : hex;
}
const SHOW_TEXT = 4; // NodeFilter.SHOW_TEXT

/** Elements that directly contain visible, non-whitespace text. */
function textElements(doc) {
  const found = new Set();
  if (!doc.body) return [];
  const walker = doc.createTreeWalker(doc.body, SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.textContent.trim() && n.parentElement) found.add(n.parentElement);
  }
  return [...found];
}

export const colorContrast = {
  id: 'color-contrast',
  wcag: '1.4.3 Contrast (Minimum)',
  severity: 'serious',
  check({ doc, win }) {
    const issues = [];
    for (const el of textElements(doc)) {
      // The design doc checked only the element's own display/visibility, which
      // flagged text inside a hidden ancestor; isRendered() checks ancestors too.
      if (!isRendered(el)) continue;
      const style = win.getComputedStyle(el);

      const bg = effectiveBackground(el);
      if (!bg) {
        issues.push({
          ...issue(
            colorContrast,
            el,
            'Text sits on an image or gradient',
            'AccessLab cannot measure this contrast, so check it by eye.',
            'Make sure the text stays readable over every part of the background.',
          ),
          severity: 'minor',
          needsReview: true,
        });
        continue;
      }
      const fg = blend(parseColor(style.color) ?? BLACK, bg);
      const ratio = contrastRatio(fg, bg);
      const needed = requiredRatio(
        parseFloat(style.fontSize) || 16,
        Number(style.fontWeight) || 400,
      );
      if (ratio >= needed) continue;

      const better = suggestColor(fg, bg, needed);
      issues.push({
        ...issue(
          colorContrast,
          el,
          'Text is too faint to read',
          `${colorName(fg)} on ${colorName(bg)} is ${ratio.toFixed(2)}:1. It needs ${needed}:1.`,
          better
            ? {
                text: `Change the text colour to \`${toHex(better)}\` (${contrastRatio(better, bg).toFixed(2)}:1), or change the background.`,
                css: `${cssPath(el)} { color: ${toHex(better)} !important; }`,
                color: toHex(better),
              }
            : 'Change the text or the background colour.',
        ),
        // The measured colours, so the UI can show swatches.
        contrast: { fg: toHex(fg), bg: toHex(bg), ratio: Number(ratio.toFixed(2)), needed },
      });
    }
    return issues;
  },
};
