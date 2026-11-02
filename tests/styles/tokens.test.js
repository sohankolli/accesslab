import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { THEMES, PAIRS, ratio, darkBlocks } from '../helpers/tokens';

describe('design tokens', () => {
  for (const theme of Object.keys(THEMES)) {
    describe(`${theme} theme`, () => {
      it.each(PAIRS)('--%s on --%s reaches %s:1 (%s)', (fg, bg, min) => {
        expect(THEMES[theme][fg], `--${fg} is defined`).toBeDefined();
        expect(THEMES[theme][bg], `--${bg} is defined`).toBeDefined();
        expect(ratio(theme, fg, bg)).toBeGreaterThanOrEqual(min);
      });
    });
  }

  it('defines the dark theme identically for data-theme="dark" and for the system setting', () => {
    expect(darkBlocks[0].trim()).toBe(darkBlocks[1].trim().replace(/\n {2}/g, '\n'));
  });

  it('takes the dialog backdrop colour from a token defined for both themes', () => {
    const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');
    const global = read('src/styles/global.css');
    expect(global).toMatch(/::backdrop\s*\{\s*background:\s*var\(--backdrop\);/);
    expect(darkBlocks[0]).toMatch(/--backdrop:/);
    expect(read('src/styles/tokens.css').match(/--backdrop:/g)).toHaveLength(3); // light, dark, system dark
  });
});
