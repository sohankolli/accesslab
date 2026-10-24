import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { overlayBoxes, issueAt, isPageLevel } from '../../src/features/audit/overlayBoxes';

const issue = (ruleId, selector, severity = 'critical') => ({
  id: `${ruleId}:${selector}`,
  ruleId,
  selector,
  severity,
});

// jsdom has no layout, so give an element a rendered box by hand.
const place = (el, rect) => {
  el.getClientRects = () => [rect];
  el.getBoundingClientRect = () => rect;
};

describe('overlayBoxes', () => {
  it('returns one box per rendered element, positioned by its rect', () => {
    const doc = new JSDOM('<main><img src="a.png"><p>hidden (no box)</p></main>').window.document;
    place(doc.querySelector('img'), { top: 10, left: 20, width: 30, height: 40 });
    const issues = [
      issue('img-alt', 'body > main > img'),
      issue('color-contrast', 'body > main > p', 'serious'), // not rendered: no rects
      issue('html-lang', 'html', 'serious'), // page-level: never boxed
      issue('page-title', 'head > title', 'serious'),
      issue('gone', 'body > nav'), // element deleted by an edit
      issue('bad', 'body > ['), // invalid selector must not throw
    ];
    expect(overlayBoxes(doc, issues)).toEqual([
      {
        id: 'img-alt:body > main > img',
        severity: 'critical',
        top: 10,
        left: 20,
        width: 30,
        height: 40,
      },
    ]);
  });
});

describe('isPageLevel', () => {
  it('is true for <html> and <head> content only', () => {
    expect(isPageLevel(issue('html-lang', 'html'))).toBe(true);
    expect(isPageLevel(issue('page-title', 'head > title'))).toBe(true);
    expect(isPageLevel(issue('img-alt', 'body > img'))).toBe(false);
  });
});

describe('issueAt', () => {
  const doc = new JSDOM(
    '<main><a href="/cart"><img src="cart.png"></a><p><span>text</span></p></main>',
  ).window.document;
  // Sorted by severity, as selectSortedIssues returns them.
  const issues = [
    issue('img-alt', 'body > main > a > img', 'critical'),
    issue('link-name', 'body > main > a', 'serious'),
    issue('landmark-main', 'html', 'minor'),
  ];

  it('picks the innermost element with an issue', () => {
    expect(issueAt(doc.querySelector('img'), issues).ruleId).toBe('img-alt');
    expect(issueAt(doc.querySelector('a'), issues).ruleId).toBe('link-name');
  });
  it('returns null for content with no issue, ignoring page-level issues', () => {
    expect(issueAt(doc.querySelector('span'), issues)).toBeNull();
  });
});
