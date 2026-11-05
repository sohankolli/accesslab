import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { loadHistory, saveHistory, readPref, writePref } from '../../src/services/storage';

const KEY = 'accesslab:v1';
const run = (id) => ({ id, ranAt: Number(id), score: 80, counts: { critical: 1 } });

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('storage', () => {
  it('saves and loads history', () => {
    expect(saveHistory({ runs: [run('1')] })).toBe(true);
    expect(loadHistory()).toEqual({ runs: [run('1')] });
  });

  it('returns false when the browser refuses to store', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    expect(saveHistory({ runs: [run('1')] })).toBe(false);
    expect(writePref('theme', 'dark')).toBe(false);
  });

  it('ignores saved history whose runs are not an array', () => {
    localStorage.setItem(KEY, JSON.stringify({ history: { runs: 'oops' } }));
    expect(loadHistory()).toEqual({ runs: [] });
    localStorage.setItem(KEY, JSON.stringify({ history: null }));
    expect(loadHistory()).toEqual({ runs: [] });
  });

  it('drops malformed runs and keeps the good ones', () => {
    const bad = [
      null,
      5,
      { id: '2' },
      { ...run('3'), score: 'high' },
      { ...run('4'), counts: null },
    ];
    localStorage.setItem(KEY, JSON.stringify({ history: { runs: [run('1'), ...bad] } }));
    expect(loadHistory().runs).toEqual([run('1')]);
  });

  it('keeps runs saved before pages were recorded, and runs with a page', () => {
    const old = run('1'); // no page: shown as "Earlier checks"
    const withPage = {
      ...run('2'),
      page: { key: 'page:café aroma menu', name: 'Café Aroma menu' },
    };
    saveHistory({ runs: [withPage, old] });
    expect(loadHistory().runs).toEqual([withPage, old]);
  });

  it('drops runs whose page is malformed', () => {
    const good = { ...run('1'), page: { key: 'page:a', name: 'A' } };
    const bad = [
      { ...run('2'), page: null },
      { ...run('3'), page: 'A' },
      { ...run('4'), page: { key: 'page:a' } },
      { ...run('5'), page: { key: 'a', name: 'A' } },
      { ...run('6'), page: { key: 'page:a', name: '' } },
    ];
    localStorage.setItem(KEY, JSON.stringify({ history: { runs: [good, ...bad] } }));
    expect(loadHistory().runs).toEqual([good]);
  });

  it('treats unreadable or non-object data as empty', () => {
    localStorage.setItem(KEY, '{not json');
    expect(loadHistory()).toEqual({ runs: [] });
    localStorage.setItem(KEY, '[1, 2]');
    expect(readPref('theme')).toBeUndefined();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(loadHistory()).toEqual({ runs: [] });
  });
});

describe('app store', () => {
  it('flags the history as unsaved when saving fails, and clears the flag when it works', async () => {
    vi.resetModules();
    const { store } = await import('../../src/app/store');
    const { runAdded } = await import('../../src/features/report/historySlice');
    const audit = (ranAt) => ({ ranAt, score: 90, issues: [], timings: {}, errors: [] });

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    store.dispatch(runAdded(audit(1)));
    expect(store.getState().history.saveFailed).toBe(true);

    setItem.mockRestore();
    store.dispatch(runAdded(audit(2)));
    expect(store.getState().history.saveFailed).toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY)).history).toEqual({
      runs: store.getState().history.runs,
    });
  });
});
