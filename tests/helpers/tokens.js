// Read the colour tokens of each theme from tokens.css and list the colour
// pairs the UI actually uses, so their contrast can be checked.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio } from '../../src/engine/color/contrast.js';

// Resolved from the project root (where Vitest runs), not via import.meta.url:
// under the jsdom environment the global URL class cannot build file: URLs.
const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8');

/** The declarations inside the first `selector { ... }` block (no nested braces). */
function block(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No ${selector} block in tokens.css`);
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}

const hexVars = (body) =>
  Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
  );

const rgb = (hex) => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
  a: 1,
});

const light = hexVars(block(':root'));
export const THEMES = {
  light,
  dark: { ...light, ...hexVars(block(":root[data-theme='dark']")) },
};
export const darkBlocks = [block(":root[data-theme='dark']"), block(":root[data-theme='system']")];

const SURFACES = ['room', 'chart', 'lens-tint']; // pane backgrounds and the open row
const SEVERITIES = ['critical', 'serious', 'moderate', 'minor'];

/** [foreground, background, minimum ratio, what it is] for every pair the UI uses. */
export const PAIRS = [
  // Text on every surface it appears on.
  ...['ink', 'graphite', 'lens', ...SEVERITIES].flatMap((fg) =>
    SURFACES.map((bg) => [fg, bg, 4.5, 'text']),
  ),
  ['on-lens', 'lens', 4.5, 'primary button text'],
  ['on-lens', 'lens-hover', 4.5, 'primary button text (hover)'],
  ['chart', 'ink', 4.5, 'chosen theme option (inverted)'],
  ['ink', 'track', 4.5, 'chosen segmented option label'],
  ['graphite', 'track', 4.5, 'other segmented option labels'],
  ['on-mark', 'mark', 4.5, 'highlighted source line'],
  ...SEVERITIES.map((s) => ['on-severity', s, 4.5, 'number on a severity disc']),
  ...SEVERITIES.map((s) => ['pin-text', `pin-${s}`, 4.5, 'number on an overlay pin']),
  // Non-text contrast (WCAG 1.4.11): 3:1.
  ...['room', 'chart'].map((bg) => ['rule-strong', bg, 3, 'form control outline']),
  ...SURFACES.map((bg) => ['lens', bg, 3, 'focus ring']),
  ...SEVERITIES.map((s) => [`pin-${s}`, 'pin-halo', 3, 'overlay outline on a white page']),
];

export const ratio = (theme, fg, bg) =>
  contrastRatio(rgb(THEMES[theme][fg]), rgb(THEMES[theme][bg]));
