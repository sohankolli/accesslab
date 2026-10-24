import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { colorContrast } from '../../src/engine/rules/colorContrast';
import { contrastRatio, blend, parseColor } from '../../src/engine/color/contrast';
import { computeScore } from '../../src/engine/runAudit';

const audit = (body) => {
  const { window } = new JSDOM(`<!doctype html><html><head></head><body>${body}</body></html>`);
  return { issues: colorContrast.check({ doc: window.document, win: window }), window };
};

describe('color-contrast: normal text', () => {
  it('passes dark text on white', () => {
    expect(audit('<p style="color:#333">Hello</p>').issues).toHaveLength(0);
  });
  it('flags #999 on white (2.85:1) with a passing fix', () => {
    const { issues } = audit('<main><p style="color:#999999">Hello</p></main>');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: 'color-contrast',
      severity: 'serious',
      selector: 'body > main > p',
      message: 'Contrast is 2.85:1; at least 4.5:1 is required.',
      fix: {
        text: 'Use #757575 (4.61:1).',
        css: 'body > main > p { color: #757575 !important; }',
      },
    });
  });
  it('flags #777 at 16px: 4.48:1 just misses 4.5:1', () => {
    expect(audit('<p style="color:#777">Hello</p>').issues).toHaveLength(1);
  });
  it('checks inherited colour, on the element that holds the text', () => {
    const { issues } = audit('<div style="color:#aaa"><span>Inherited</span></div>');
    expect(issues.map((i) => i.selector)).toEqual(['body > div > span']);
  });
});

describe('color-contrast: large text needs only 3:1', () => {
  it('passes #777 (4.48:1) at 24px, and at 18.66px bold', () => {
    expect(audit('<p style="color:#777;font-size:24px">Big</p>').issues).toHaveLength(0);
    expect(
      audit('<p style="color:#777;font-size:18.66px;font-weight:700">Bold</p>').issues,
    ).toHaveLength(0);
  });
  it('still needs 4.5:1 at 18px bold or 23px regular', () => {
    expect(audit('<p style="color:#777;font-size:18px;font-weight:700">x</p>').issues).toHaveLength(
      1,
    );
    expect(audit('<p style="color:#777;font-size:23px">x</p>').issues).toHaveLength(1);
  });
  it('counts a default <h1> (32px bold) as large text', () => {
    expect(audit('<h1 style="color:#888">Heading</h1>').issues).toHaveLength(0); // 3.54:1
  });
  it('fails large text below 3:1', () => {
    const { issues } = audit('<p style="color:#aaa;font-size:30px">Big</p>'); // 2.32:1
    expect(issues[0].message).toBe('Contrast is 2.32:1; at least 3:1 is required.');
  });
});

describe('color-contrast: translucent backgrounds', () => {
  it('composites a translucent background over white before measuring', () => {
    // #555 on rgba(0,0,0,0.5) over white = #555 on mid grey: 1.87:1
    const { issues } = audit(
      '<div style="background:rgba(0,0,0,0.5)"><p style="color:#555">x</p></div>',
    );
    expect(issues[0].message).toBe('Contrast is 1.87:1; at least 4.5:1 is required.');
  });
  it('stacks translucent layers over the nearest opaque ancestor', () => {
    const { issues } = audit(
      '<div style="background:#000"><div style="background:rgba(255,255,255,0.5)"><p style="color:#fff">x</p></div></div>',
    );
    const bg = blend(parseColor('rgba(255, 255, 255, 0.5)'), { r: 0, g: 0, b: 0, a: 1 });
    const expected = contrastRatio({ r: 255, g: 255, b: 255 }, bg).toFixed(2);
    expect(issues[0].message).toBe(`Contrast is ${expected}:1; at least 4.5:1 is required.`);
  });
  it('composites translucent text over its background', () => {
    // black at 30% opacity on white is a light grey
    expect(audit('<p style="color:rgba(0,0,0,0.3)">x</p>').issues).toHaveLength(1);
    expect(audit('<p style="color:rgba(0,0,0,0.9)">x</p>').issues).toHaveLength(0);
  });
});

describe('color-contrast: images and gradients', () => {
  it('marks text on a gradient for manual review, not as a failure', () => {
    const { issues } = audit(
      '<div style="background:linear-gradient(#fff, #000)"><p style="color:#000">x</p></div>',
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      severity: 'minor',
      needsReview: true,
      message: 'Text sits on an image or gradient.',
    });
    expect(issues[0].fix.css).toBeUndefined();
  });
  it('marks text on a background image for review', () => {
    const { issues } = audit('<div style="background-image:url(hero.jpg)"><p>x</p></div>');
    expect(issues[0].needsReview).toBe(true);
  });
  it('does not lower the score for review items', () => {
    const { issues } = audit('<div style="background:linear-gradient(red, blue)"><p>x</p></div>');
    expect(computeScore([{ rule: colorContrast, issues }])).toBe(100);
  });
});

describe('color-contrast: hidden text is skipped', () => {
  it('skips text inside a hidden ancestor and visibility:hidden text', () => {
    expect(audit('<div hidden><p style="color:#ccc">x</p></div>').issues).toHaveLength(0);
    expect(
      audit('<div style="display:none"><p style="color:#ccc">x</p></div>').issues,
    ).toHaveLength(0);
    expect(audit('<p style="color:#ccc;visibility:hidden">x</p>').issues).toHaveLength(0);
  });
  it('checks a visible child of a visibility:hidden parent', () => {
    expect(
      audit('<div style="visibility:hidden"><p style="visibility:visible;color:#ccc">x</p></div>')
        .issues,
    ).toHaveLength(1);
  });
});

describe('color-contrast: fixes', () => {
  it('applying fix.css removes the issue', () => {
    const { issues, window } = audit('<main><p class="note">Prices</p></main>');
    expect(issues).toHaveLength(0); // sanity: black by default
    const doc = window.document;
    const style = doc.createElement('style');
    style.textContent = '.note { color: #aaaaaa; }';
    doc.head.append(style);
    const [failing] = colorContrast.check({ doc, win: window });
    expect(failing).toBeDefined();
    style.textContent += failing.fix.css;
    expect(colorContrast.check({ doc, win: window })).toHaveLength(0);
  });
});
