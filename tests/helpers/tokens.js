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

const SURFACES = ['bg', 'surface', 'raised'];
const SEVERITIES = ['critical', 'serious', 'moderate', 'minor'];

/** [foreground, background, minimum ratio, what it is] for every pair the UI uses. */
export const PAIRS = [
  ...['text', 'muted', 'accent', ...SEVERITIES].flatMap((fg) =>
    SURFACES.map((bg) => [fg, bg, 4.5, 'text']),
  ),
  ['accent-contrast', 'accent', 4.5, 'primary button text'],
  ['accent-contrast', 'accent-hover', 4.5, 'primary button text (hover)'],
  ['text', 'accent-subtle', 4.5, 'text on selected card'],
  ['muted', 'accent-subtle', 4.5, 'secondary text on selected card'],
  ['accent', 'accent-subtle', 4.5, 'accent text on selected card'],
  ...SEVERITIES.map((s) => [s, `${s}-subtle`, 4.5, 'severity chip text']),
  ...SEVERITIES.map((s) => ['bg', s, 4.5, 'overlay label text']),
  ...SURFACES.map((bg) => ['border-strong', bg, 3, 'control outline (1.4.11)']),
  ...SURFACES.map((bg) => ['accent', bg, 3, 'focus ring (1.4.11)']),
  ['accent', 'accent-subtle', 3, 'selected card outline (1.4.11)'],
];

export const ratio = (theme, fg, bg) =>
  contrastRatio(rgb(THEMES[theme][fg]), rgb(THEMES[theme][bg]));
