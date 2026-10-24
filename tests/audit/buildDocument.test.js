import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { buildDocument } from '../../src/features/audit/SandboxFrame';
import { runAudit } from '../../src/engine/runAudit';
import { RULES } from '../../src/engine/rules';
import { SAMPLE_HTML, SAMPLE_CSS } from '../../src/features/editor/samplePage';

const parse = (src) => new JSDOM(src).window.document;

describe('buildDocument', () => {
  it('wraps a fragment in a marked document with the CSS in <head>', () => {
    const d = parse(buildDocument('<img src="x.png">', 'img { border: 0 }'));
    expect(d.documentElement.hasAttribute('data-al-fragment')).toBe(true);
    expect(d.compatMode).toBe('CSS1Compat'); // has a doctype: standards mode
    expect(d.head.querySelector('style').textContent).toBe('img { border: 0 }');
    expect(d.body.innerHTML).toBe('<img src="x.png">');
  });

  it('injects CSS into the <head> of a full page and does not mark it', () => {
    const page =
      '<!doctype html><html lang="en"><head><title>T</title></head><body><p>Hi</p></body></html>';
    const src = buildDocument(page, 'p { color: red }');
    expect(src).toContain('<title>T</title><style>p { color: red }</style></head>');
    const d = parse(src);
    expect(d.documentElement.hasAttribute('data-al-fragment')).toBe(false);
    expect(d.head.querySelector('style').textContent).toBe('p { color: red }');
  });

  it('keeps standards mode for a full page without </head>', () => {
    const d = parse(buildDocument('<!doctype html><html lang="en"><p>Hi</p>', 'p { margin: 0 }'));
    expect(d.compatMode).toBe('CSS1Compat');
    expect(d.head.querySelector('style').textContent).toBe('p { margin: 0 }');
    expect(d.body.textContent).toBe('Hi');
  });

  it('does not treat "$&" in CSS as a replacement pattern', () => {
    const src = buildDocument('<html><head></head></html>', 'a::after { content: "$&" }');
    expect(src).toContain('content: "$&"');
  });

  it('stops CSS from closing its own <style> element', () => {
    const d = parse(buildDocument('<p>Hi</p>', 'p {}</style><script>alert(1)</script>'));
    expect(d.querySelectorAll('script')).toHaveLength(0);
    expect(d.querySelectorAll('style')).toHaveLength(1);
  });
});

describe('sample page', () => {
  it('has exactly the three deliberate problems', () => {
    const audit = runAudit(parse(buildDocument(SAMPLE_HTML, SAMPLE_CSS)), RULES);
    expect(audit.issues.map((i) => i.ruleId).sort()).toEqual([
      'form-label',
      'heading-order',
      'img-alt',
    ]);
    expect(audit.score).toBe(67);
  });

  it('a pasted <img src="x.png"> fragment scores lower than a clean one', () => {
    const score = (html) => runAudit(parse(buildDocument(html, '')), RULES).score;
    expect(score('<p>Hello</p>')).toBe(100);
    expect(score('<img src="x.png">')).toBe(86);
  });
});
