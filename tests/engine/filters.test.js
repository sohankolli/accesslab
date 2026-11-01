import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { CVD, toFeValues, applySimulation } from '../../src/engine/simulate/filters';

const doc = () => new JSDOM('<!doctype html><html><body><p>Hi</p></body></html>').window.document;

describe('toFeValues', () => {
  it('turns a 3x3 matrix into the 20 feColorMatrix values with an identity alpha row', () => {
    const values = toFeValues(CVD.protanopia).split(' ').map(Number);
    expect(values).toHaveLength(20);
    expect(values.slice(0, 5)).toEqual([0.152286, 1.052583, -0.204868, 0, 0]);
    expect(values.slice(15)).toEqual([0, 0, 0, 1, 0]);
  });

  it('has a Machado matrix for each colour-vision lens, rows summing to about 1', () => {
    for (const mode of ['protanopia', 'deuteranopia', 'tritanopia']) {
      for (const row of CVD[mode]) {
        expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2); // white stays white
      }
    }
  });
});

describe('applySimulation', () => {
  it('adds one hidden SVG filter and points <html> at it for a colour lens', () => {
    const d = doc();
    applySimulation(d, 'deuteranopia');
    const svg = d.getElementById('al-sim');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelector('feColorMatrix').getAttribute('values')).toBe(
      toFeValues(CVD.deuteranopia),
    );
    expect(d.documentElement.style.filter).toMatch(/^url\("?#al-cvd"?\)$/);
    applySimulation(d, 'tritanopia');
    expect(d.querySelectorAll('#al-sim')).toHaveLength(1);
  });

  it('blurs for low vision and doubles the root font size for 200% text', () => {
    const d = doc();
    applySimulation(d, 'low-vision');
    expect(d.documentElement.style.filter).toBe('blur(2px) contrast(0.8)');
    applySimulation(d, 'zoom-200');
    expect(d.documentElement.style.filter).toBe('');
    expect(d.documentElement.style.fontSize).toBe('200%');
    expect(d.documentElement.style.transform).toBe('');
  });

  it('"none" removes every trace of a previous lens', () => {
    const d = doc();
    applySimulation(d, 'protanopia');
    applySimulation(d, 'none');
    expect(d.getElementById('al-sim')).toBeNull();
    expect(d.documentElement.getAttribute('style') ?? '').toBe('');
  });
});
