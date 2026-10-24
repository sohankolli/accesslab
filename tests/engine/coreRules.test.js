import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { buttonName } from '../../src/engine/rules/buttonName';
import { linkName } from '../../src/engine/rules/linkName';
import { tabindexPositive } from '../../src/engine/rules/tabindexPositive';
import { duplicateId } from '../../src/engine/rules/duplicateId';
import { landmarkMain } from '../../src/engine/rules/landmarkMain';
import { RULES } from '../../src/engine/rules';

const doc = (html) => new JSDOM(html).window.document;
const check = (rule, html) => rule.check({ doc: doc(html) });
const fragment = (body) =>
  doc(`<!doctype html><html data-al-fragment><head></head><body>${body}</body></html>`);

describe('button-name', () => {
  it('passes buttons named by text, aria-label, an image alt, or a default label', () => {
    const html = `
      <button>Save</button>
      <button aria-label="Close"><svg aria-hidden="true"></svg></button>
      <button><img src="x.png" alt="Search"></button>
      <div role="button">Menu</div>
      <input type="button" value="Go"><input type="submit"><input type="reset">
      <input type="image" src="go.png" alt="Go">`;
    expect(check(buttonName, html)).toHaveLength(0);
  });
  it('flags icon-only and empty buttons', () => {
    const issues = check(
      buttonName,
      '<button><svg></svg></button><div role="button"></div><input type="button">',
    );
    expect(issues.map((i) => i.selector)).toEqual(['body > button', 'body > div', 'body > input']);
    expect(issues[0]).toMatchObject({
      severity: 'critical',
      message: 'A button has no name',
      impact: 'Screen reader users hear "button" and nothing else.',
    });
  });
});

describe('link-name', () => {
  it('passes links named by text, an image alt or aria-label', () => {
    const html = `<a href="/">Home</a><a href="/cart" aria-label="Cart"><svg></svg></a>
      <a href="/x"><img src="logo.png" alt="Café Aroma"></a><a>not a link (no href)</a>`;
    expect(check(linkName, html)).toHaveLength(0);
  });
  it('flags an icon-only link', () => {
    const issues = check(linkName, '<a href="/">Home</a><a href="/cart"><svg></svg></a>');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ selector: 'body > a:nth-of-type(2)', severity: 'serious' });
  });
});

describe('tabindex-positive', () => {
  it('passes tabindex 0 and -1', () => {
    expect(
      check(tabindexPositive, '<div tabindex="0">a</div><div tabindex="-1">b</div>'),
    ).toHaveLength(0);
  });
  it('flags a positive tabindex', () => {
    const issues = check(tabindexPositive, '<a href="/" tabindex="3">Skip</a>');
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe('Focus jumps out of reading order');
    expect(issues[0].impact).toBe(
      'Keyboard users reach this element early because of `tabindex="3"`.',
    );
  });
});

describe('duplicate-id', () => {
  it('passes unique ids', () => {
    expect(check(duplicateId, '<p id="a">1</p><p id="b">2</p>')).toHaveLength(0);
  });
  it('flags each repeated value once, on its second occurrence', () => {
    const issues = check(
      duplicateId,
      '<p id="a">1</p><p id="a">2</p><p id="a">3</p><p id="b">4</p>',
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      selector: 'body > p:nth-of-type(2)',
      message: 'The id "a" is used 3 times',
    });
  });
});

describe('landmark-main', () => {
  it('passes a page with one <main> (a hidden second one does not count)', () => {
    expect(
      check(landmarkMain, '<html><body><main>a</main><main hidden>b</main></body></html>'),
    ).toHaveLength(0);
  });
  it('flags a page with no <main>', () => {
    const issues = check(landmarkMain, '<html><body><div>a</div></body></html>');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      selector: 'html',
      message: 'The page has no main landmark',
    });
  });
  it('flags a second visible <main>', () => {
    const issues = check(
      landmarkMain,
      '<html><body><main>a</main><div role="main">b</div></body></html>',
    );
    expect(issues.map((i) => i.selector)).toEqual(['body > div']);
  });
  it('skips pasted fragments', () => {
    expect(landmarkMain.check({ doc: fragment('<p>Hi</p>') })).toHaveLength(0);
  });
});

describe('core rule set', () => {
  it('has the eleven core rules from Table 6', () => {
    expect(RULES.map((r) => r.id).sort()).toEqual([
      'button-name',
      'color-contrast',
      'duplicate-id',
      'form-label',
      'heading-order',
      'html-lang',
      'img-alt',
      'landmark-main',
      'link-name',
      'page-title',
      'tabindex-positive',
    ]);
  });
});
