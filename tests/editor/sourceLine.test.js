import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { sourceLineOf, startTags, lineAndColumn } from '../../src/features/editor/sourceLine';
import { runAudit } from '../../src/engine/runAudit';
import { RULES } from '../../src/engine/rules';
import { buildDocument } from '../../src/features/audit/SandboxFrame';
import { SAMPLE_HTML, SAMPLE_CSS } from '../../src/features/editor/samplePage';

describe('startTags', () => {
  it('skips comments, doctypes, end tags and raw text', () => {
    const src = `<!doctype html><!-- <p> --><p a=">">x</p><script>if (a<b) "<i>"</script><style>b{}</style><textarea><b></textarea><em>`;
    expect(startTags(src).map((t) => t.tag)).toEqual(['p', 'script', 'style', 'textarea', 'em']);
  });
  it('finds the end of a tag past quoted ">" characters', () => {
    const src = '<img alt="a > b" src=x>';
    expect(startTags(src)[0].end).toBe(src.length);
  });
});

describe('lineAndColumn', () => {
  it('is 1-based', () => {
    expect(lineAndColumn('ab\ncd', 0)).toEqual({ line: 1, column: 1 });
    expect(lineAndColumn('ab\ncd', 4)).toEqual({ line: 2, column: 2 });
  });
});

describe('sourceLineOf', () => {
  const src = '<h1>A</h1>\n<p>one</p>\n  <P class="x">two</P>\n';
  it('finds the nth start tag of a name, case-insensitively', () => {
    expect(sourceLineOf(src, { tag: 'p', nth: 1 })).toMatchObject({ line: 3, column: 3 });
    expect(sourceLineOf(src, { tag: 'h1', nth: 0 })).toMatchObject({ line: 1, column: 1 });
  });
  it('returns null for elements the source does not contain', () => {
    expect(sourceLineOf(src, { tag: 'body', nth: 0 })).toBeNull();
    expect(sourceLineOf(src, { tag: 'p', nth: 5 })).toBeNull();
    expect(sourceLineOf(src, undefined)).toBeNull();
  });

  it("matches every issue in the sample page to its element's line", () => {
    const { window } = new JSDOM(buildDocument(SAMPLE_HTML, SAMPLE_CSS));
    const { issues } = runAudit(window.document, RULES);
    const lines = SAMPLE_HTML.split('\n');
    const found = Object.fromEntries(
      issues.map((i) => [i.ruleId, lines[sourceLineOf(SAMPLE_HTML, i.source).line - 1].trim()]),
    );
    expect(found['img-alt']).toMatch(/^<img /);
    expect(found['form-label']).toBe('<input type="email" placeholder="Your email">');
    expect(found['heading-order']).toBe("<h3>Today's specials</h3>");
    expect(found['color-contrast']).toBe('<p class="note">Prices include GST.</p>');
  });
});
