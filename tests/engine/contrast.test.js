import { describe, it, expect } from 'vitest';
import {
  parseColor,
  luminance,
  contrastRatio,
  blend,
  requiredRatio,
} from '../../src/engine/color/contrast';
import { suggestColor, rgbToHsl, hslToRgb, toHex } from '../../src/engine/color/suggest';

const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const BLACK = { r: 0, g: 0, b: 0, a: 1 };
const grey = (v) => ({ r: v, g: v, b: v, a: 1 });
const hex = (h) => ({
  r: parseInt(h.slice(1, 3), 16),
  g: parseInt(h.slice(3, 5), 16),
  b: parseInt(h.slice(5, 7), 16),
  a: 1,
});

describe('contrastRatio', () => {
  it('black on white is 21:1', () => {
    expect(contrastRatio(grey(0), WHITE)).toBeCloseTo(21, 5);
  });
  it('#777 on white just fails AA (4.48:1)', () => {
    expect(contrastRatio(grey(119), WHITE)).toBeCloseTo(4.48, 2);
  });
  it('is symmetric and 1:1 for identical colours', () => {
    expect(contrastRatio(WHITE, grey(119))).toBe(contrastRatio(grey(119), WHITE));
    expect(contrastRatio(grey(119), grey(119))).toBe(1);
  });
});

describe('luminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(luminance(BLACK)).toBe(0);
    expect(luminance(WHITE)).toBeCloseTo(1, 10);
  });
});

describe('parseColor', () => {
  it('reads rgb() and rgba() as returned by getComputedStyle', () => {
    expect(parseColor('rgb(10, 20, 30)')).toEqual({ r: 10, g: 20, b: 30, a: 1 });
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
  });
  it('returns null for anything else', () => {
    expect(parseColor('transparent')).toBeNull();
    expect(parseColor(undefined)).toBeNull();
  });
});

describe('blend', () => {
  it('composites a translucent colour over an opaque one', () => {
    expect(blend({ r: 0, g: 0, b: 0, a: 0.5 }, WHITE)).toEqual({
      r: 127.5,
      g: 127.5,
      b: 127.5,
      a: 1,
    });
  });
});

describe('requiredRatio', () => {
  it('needs 4.5:1 for normal text and 3:1 for large text', () => {
    expect(requiredRatio(16, 400)).toBe(4.5);
    expect(requiredRatio(24, 400)).toBe(3);
    expect(requiredRatio(19, 700)).toBe(3);
    expect(requiredRatio(19, 400)).toBe(4.5);
  });
});

describe('colour conversion', () => {
  it('round-trips RGB through HSL', () => {
    for (const c of ['#6495ed', '#ff7f50', '#757575', '#0b5cad']) {
      expect(toHex(hslToRgb(rgbToHsl(hex(c))))).toBe(c);
    }
  });
});

describe('suggestColor', () => {
  it('matches the worked examples in Table 7', () => {
    expect(toHex(suggestColor(hex('#999999'), WHITE, 4.5))).toBe('#757575');
    expect(toHex(suggestColor(hex('#6495ED'), WHITE, 4.5))).toBe('#2d70e7');
    expect(toHex(suggestColor(hex('#FF7F50'), WHITE, 4.5))).toBe('#da3a00');
  });

  it('suggested colour always passes', () => {
    expect(contrastRatio(suggestColor(grey(153), WHITE, 4.5), WHITE)).toBeGreaterThanOrEqual(4.5);

    // Many hues, saturations and lightnesses, on light, dark and mid backgrounds.
    const backgrounds = [WHITE, BLACK, hex('#333333'), hex('#dddddd'), hex('#f6f7f9')];
    for (const bg of backgrounds) {
      for (const target of [4.5, 3]) {
        for (let h = 0; h < 1; h += 1 / 12) {
          for (const s of [0, 0.5, 1]) {
            for (let l = 0.1; l < 0.95; l += 0.1) {
              const fg = hslToRgb({ h, s, l });
              const better = suggestColor(fg, bg, target);
              expect(better).not.toBeNull();
              expect(contrastRatio(better, bg)).toBeGreaterThanOrEqual(target);
            }
          }
        }
      }
    }
  });

  it('keeps the hue: only lightness changes', () => {
    const before = rgbToHsl(hex('#6495ED'));
    const after = rgbToHsl(suggestColor(hex('#6495ED'), WHITE, 4.5));
    expect(after.h).toBeCloseTo(before.h, 2);
  });
});
