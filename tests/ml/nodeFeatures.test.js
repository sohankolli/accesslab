import { describe, it, expect } from 'vitest';
import {
  extractRows,
  isCandidate,
  isStructuralCandidate,
  nodeFeatures,
  NODE_DIM,
  ROW_DIM,
  OFFSETS,
  DENSE,
  TAGS,
} from '../../src/engine/ml/nodeFeatures';
import { FEATURE_SOURCE } from '../../ml/crawler/featureScript.mjs';

const page = `
  <style>.btn { cursor: pointer; border-radius: 4px; background: #33c; }</style>
  <nav><ul class="menu"><li class="menu-item">Home</li><li><a href="/">Shop</a></li></ul></nav>
  <div class="btn" id="buy" onclick="buy()">Buy</div>
  <button type="button"><span id="inside">Send</span></button>
  <div role="button" tabindex="0">Has a role</div>
  <p hidden id="gone">Hidden</p>
  <svg id="icon"><path d="M0 0h1"/></svg>`;

describe('the 92 features', () => {
  it('has 92 values per element and 552 per row', () => {
    expect(NODE_DIM).toBe(92);
    expect(ROW_DIM).toBe(552);
    expect(TAGS).toHaveLength(16);
    expect(DENSE).toHaveLength(12);
  });

  it('reads the cues of a button-like div', () => {
    document.body.innerHTML = page;
    const x = nodeFeatures(document.getElementById('buy'));
    const d = (name) => x[OFFSETS.dense + DENSE.indexOf(name)];
    expect(x[TAGS.indexOf('DIV')]).toBe(1);
    expect(d('pointer cursor')).toBe(1);
    expect(d('inline on… attribute')).toBe(1);
    expect(d('background colour')).toBe(1);
    // Rounded corners need real layout styles: jsdom does not compute border
    // radii, so that cue is checked in Chromium (ml/crawler/test).
    expect(d('native control')).toBe(0);
  });

  it('puts unknown tags in the OTHER slot', () => {
    document.body.innerHTML = '<article id="a">x</article>';
    const x = nodeFeatures(document.getElementById('a'));
    expect(x[TAGS.indexOf('OTHER')]).toBe(1);
  });
});

describe('candidates', () => {
  it('skips controls, their contents, control roles, hidden elements and SVG parts', () => {
    document.body.innerHTML = page;
    const byId = (id) => document.getElementById(id);
    expect(isCandidate(byId('buy'))).toBe(true);
    expect(isCandidate(document.querySelector('.menu-item'))).toBe(true);
    expect(isStructuralCandidate(document.querySelector('a'))).toBe(false);
    expect(isStructuralCandidate(byId('inside'))).toBe(false);
    expect(isStructuralCandidate(document.querySelector('[role=button]'))).toBe(false);
    expect(isCandidate(byId('gone'))).toBe(false);
    expect(isStructuralCandidate(document.querySelector('path'))).toBe(false);
    expect(isStructuralCandidate(byId('icon'))).toBe(true);
  });

  it('extracts one 552-value row per candidate, in document order', () => {
    document.body.innerHTML = page;
    const { candidates, rows, truncated } = extractRows(document);
    expect(candidates.map((el) => el.id || el.className || el.localName)).toContain('buy');
    expect(rows).toHaveLength(candidates.length);
    expect(rows.every((r) => r.length === ROW_DIM)).toBe(true);
    expect(truncated).toBe(false);
  });

  it('says when a page was cut short', () => {
    document.body.innerHTML = '<div></div>'.repeat(20);
    expect(extractRows(document, { maxCandidates: 5 }).truncated).toBe(true);
    expect(extractRows(document, { maxCandidates: 5 }).rows).toHaveLength(5);
  });
});

describe('feature parity with the crawler', () => {
  it('the crawler runs exactly this code: same rows from its injected copy', () => {
    document.body.innerHTML = page;
    const injected = new Function(`return (${FEATURE_SOURCE})()`)();
    const app = extractRows(document);
    const crawler = injected.extractRows(document);
    expect(crawler.candidates).toEqual(app.candidates);
    expect(crawler.rows.map((r) => Array.from(r))).toEqual(app.rows.map((r) => Array.from(r)));
  });
});
