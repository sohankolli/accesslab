import { describe, it, expect } from 'vitest';
import { propagate, tokenVector, classWords, HASH_BUCKETS } from '../../src/engine/ml/graph';

/** A tiny tree; each node's features are [its own number], so views are easy to read. */
function tree(html) {
  document.body.innerHTML = html;
  const nodes = [...document.body.querySelectorAll('*')];
  const X = nodes.map((el) => Float32Array.of(Number(el.dataset.v)));
  return { nodes, X, at: (id) => nodes.findIndex((el) => el.id === id) };
}

describe('propagate', () => {
  const html = `
    <ul id="menu" data-v="1">
      <li id="a" data-v="2"><span id="a1" data-v="5"><i id="a11" data-v="9"></i></span></li>
      <li id="b" data-v="3"></li>
      <li id="c" data-v="4"></li>
    </ul>`;

  it('lays out self, parent, mean of children, mean of siblings, grandparent, mean of grandchildren', () => {
    const { nodes, X, at } = tree(html);
    const [row] = propagate(nodes, X, [at('a1')]);
    // a1: self 5, parent li#a 2, children [i 9], siblings none, grandparent ul 1, grandchildren none
    expect(Array.from(row)).toEqual([5, 2, 9, 0, 1, 0]);
  });

  it('averages siblings and grandchildren', () => {
    const { nodes, X, at } = tree(html);
    const [menu, b] = propagate(nodes, X, [at('menu'), at('b')]);
    // ul: no parent (body is outside the graph), children mean (2+3+4)/3, grandchildren [5]
    expect(Array.from(menu)).toEqual([1, 0, 3, 0, 0, 5]);
    // li#b: siblings a and c, mean (2+4)/2 = 3
    expect(Array.from(b)).toEqual([3, 1, 0, 3, 0, 0]);
  });

  it('builds rows for every node when no subset is given', () => {
    const { nodes, X } = tree(html);
    const rows = propagate(nodes, X);
    expect(rows).toHaveLength(nodes.length);
    expect(rows.every((r) => r.length === 6)).toBe(true);
  });
});

describe('class-name words', () => {
  const el = (cls) => {
    const d = document.createElement('div');
    d.className = cls;
    return d;
  };
  const cosine = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

  it('hashes into a unit vector of HASH_BUCKETS values', () => {
    const v = tokenVector(el('btn btn-primary'));
    expect(v).toHaveLength(HASH_BUCKETS);
    expect(Math.hypot(...v)).toBeCloseTo(1, 5);
  });

  it('puts related words closer than unrelated ones', () => {
    const btn = tokenVector(el('btn'));
    expect(cosine(btn, tokenVector(el('cta-btn')))).toBeGreaterThan(
      cosine(btn, tokenVector(el('paragraph'))),
    );
  });

  it('gives zeros, not NaN, for an element without class or id', () => {
    expect(Array.from(tokenVector(el(''))).every((v) => v === 0)).toBe(true);
  });

  it('reads class and id words in lower case', () => {
    const d = el('Close_Icon');
    d.id = 'Main';
    expect(classWords(d)).toEqual(['close', 'icon', 'main']);
  });
});
