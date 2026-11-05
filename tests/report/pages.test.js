import { describe, it, expect } from 'vitest';
import {
  EARLIER_KEY,
  groupByPage,
  pageKeyOf,
  pageNameFor,
  pageOf,
  previousRunOfPage,
} from '../../src/features/report/pages';

const run = (ranAt, name) => ({
  id: String(ranAt),
  ranAt,
  score: ranAt,
  counts: {},
  ...(name ? { page: pageOf({ title: name }) } : {}),
});

describe('pages', () => {
  it('names a page by its title, else the file name, else "Untitled page"', () => {
    expect(pageNameFor({ title: '  Café \n  Aroma menu ', fileName: 'menu.html' })).toBe(
      'Café Aroma menu',
    );
    expect(pageNameFor({ title: '   ', fileName: 'menu.html' })).toBe('menu.html');
    expect(pageNameFor({ title: '', fileName: null })).toBe('Untitled page');
    expect(pageNameFor({})).toBe('Untitled page');
  });

  it('bases the key on the name, ignoring case, never on the code', () => {
    expect(pageOf({ title: 'Café Aroma menu' })).toEqual({
      key: 'page:café aroma menu',
      name: 'Café Aroma menu',
    });
    expect(pageOf({ title: 'MENU' }).key).toBe(pageOf({ title: 'menu' }).key);
    // A page titled "earlier" can never join the "Earlier checks" group.
    expect(pageOf({ title: 'earlier' }).key).not.toBe(EARLIER_KEY);
  });

  it('puts runs without a page under "Earlier checks"', () => {
    expect(pageKeyOf(run(1))).toBe(EARLIER_KEY);
  });

  it('groups runs by page, the page checked most recently first', () => {
    const runs = [run(5, 'B'), run(4, 'A'), run(3, 'B'), run(2), run(1)];
    expect(groupByPage(runs).map((g) => [g.name, g.runs.map((r) => r.ranAt)])).toEqual([
      ['B', [5, 3]],
      ['A', [4]],
      ['Earlier checks', [2, 1]],
    ]);
  });

  it('finds the previous run of the same page only', () => {
    const runs = [run(4, 'A'), run(3, 'B'), run(2, 'A'), run(1)];
    expect(previousRunOfPage(runs, runs[0])?.ranAt).toBe(2);
    expect(previousRunOfPage(runs, runs[1])).toBeUndefined();
    expect(previousRunOfPage(runs, runs[3])).toBeUndefined();
  });
});
