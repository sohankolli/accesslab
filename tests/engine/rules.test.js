import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  imgAlt,
  formLabel,
  headingOrder,
  htmlLang,
  pageTitle,
} from '../../src/engine/rules/basicRules';

const doc = (html) => new JSDOM(html).window.document;
// What buildDocument() produces for a pasted snippet.
const fragment = (body) =>
  doc(`<!doctype html><html data-al-fragment><head></head><body>${body}</body></html>`);

describe('img-alt', () => {
  it('passes images with alt text or a decorative alt=""', () => {
    expect(
      imgAlt.check({ doc: doc('<img src="a.png" alt="A cat"><img src="b.png" alt="">') }),
    ).toHaveLength(0);
  });
  it('flags an image with no alt attribute', () => {
    const issues = imgAlt.check({ doc: doc('<img src="a.png"><img src="b.png" alt="">') });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      id: 'img-alt:body > img:nth-of-type(1)',
      ruleId: 'img-alt',
      severity: 'critical',
      selector: 'body > img:nth-of-type(1)',
      snippet: '<img src="a.png">',
    });
  });
});

describe('form-label', () => {
  it('passes fields named by <label>, aria-label or aria-labelledby', () => {
    const d = doc(`
      <label for="e">Email</label><input id="e" type="email">
      <label>Name <input type="text"></label>
      <input aria-label="Search">
      <span id="q">Quantity</span><input aria-labelledby="q">
      <input type="submit"><input type="hidden">`);
    expect(formLabel.check({ doc: d })).toHaveLength(0);
  });
  it('flags a field with no label, and one named only by its placeholder', () => {
    const issues = formLabel.check({
      doc: doc('<input id="a" type="text"><textarea id="b" placeholder="Message"></textarea>'),
    });
    expect(issues.map((i) => [i.selector, i.message])).toEqual([
      ['#a', 'Form field has no label.'],
      ['#b', 'Field is named only by placeholder/title.'],
    ]);
  });
});

describe('heading-order', () => {
  it('passes headings that go down one level at a time (and back up freely)', () => {
    expect(
      headingOrder.check({ doc: doc('<h1>A</h1><h2>B</h2><h3>C</h3><h2>D</h2>') }),
    ).toHaveLength(0);
  });
  it('flags h1 → h3 once', () => {
    const issues = headingOrder.check({ doc: doc('<h1>A</h1><h3>B</h3><h4>C</h4><h2>D</h2>') });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe('Heading level jumps from h1 to h3.');
  });
});

describe('html-lang', () => {
  it('passes a page with a lang attribute', () => {
    expect(htmlLang.check({ doc: doc('<html lang="en"><body></body></html>') })).toHaveLength(0);
  });
  it('flags a page with a missing or blank lang', () => {
    expect(htmlLang.check({ doc: doc('<html><body></body></html>') })).toHaveLength(1);
    expect(htmlLang.check({ doc: doc('<html lang=" "><body></body></html>') })).toHaveLength(1);
  });
  it('skips pasted fragments', () => {
    expect(htmlLang.check({ doc: fragment('<p>Hi</p>') })).toHaveLength(0);
  });
});

describe('page-title', () => {
  it('passes a page with a non-empty <title>', () => {
    expect(
      pageTitle.check({ doc: doc('<html><head><title>Menu</title></head></html>') }),
    ).toHaveLength(0);
  });
  it('flags a page with no <title>', () => {
    const issues = pageTitle.check({ doc: doc('<html><head></head><body></body></html>') });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ selector: 'html', message: 'Page has no <title>.' });
  });
  it('flags an empty <title>', () => {
    const issues = pageTitle.check({ doc: doc('<html><head><title>  </title></head></html>') });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ selector: 'head > title', message: '<title> is empty.' });
  });
  it('skips pasted fragments', () => {
    expect(pageTitle.check({ doc: fragment('<p>Hi</p>') })).toHaveLength(0);
  });
});
