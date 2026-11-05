import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  loadHistory,
  saveHistory,
  readPref,
  writePref,
  loadEditor,
  saveEditor,
} from '../../src/services/storage';
import { MAX_PAGE_BYTES } from '../../src/features/editor/editorSlice';
import { SAMPLE_HTML, SAMPLE_CSS } from '../../src/features/editor/samplePage';

const KEY = 'accesslab:v1';
const run = (id) => ({ id, ranAt: Number(id), score: 80, counts: { critical: 1 } });

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

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

describe('saved editor code', () => {
  const code = { html: '<p>Mine</p>', css: 'p { color: red }', source: 'paste', fileName: null };
  const saveRaw = (editor) => localStorage.setItem(KEY, JSON.stringify({ editor }));

  it('saves and loads the code', () => {
    expect(saveEditor(code)).toBe(true);
    expect(loadEditor()).toEqual(code);
  });

  it('keeps the name of an opened file', () => {
    saveEditor({ ...code, source: 'file', fileName: 'menu.html' });
    expect(loadEditor()).toEqual({ ...code, source: 'file', fileName: 'menu.html' });
  });

  it('keeps the history when the code is saved, and the code when the history is', () => {
    saveHistory({ runs: [run('1')] });
    saveEditor(code);
    saveHistory({ runs: [run('1'), run('2')] });
    expect(loadEditor()).toEqual(code);
    expect(loadHistory().runs).toHaveLength(2);
  });

  it('ignores malformed saved code', () => {
    for (const bad of [
      null,
      'html',
      [],
      { ...code, html: 5 },
      { ...code, css: null },
      { css: code.css, source: 'paste' },
      { ...code, source: 'server' },
      { ...code, fileName: 7 },
    ]) {
      saveRaw(bad);
      expect(loadEditor()).toBeNull();
    }
    localStorage.setItem(KEY, '{not json');
    expect(loadEditor()).toBeNull();
  });

  it('ignores saved code over the size cap', () => {
    saveRaw({ ...code, html: 'a'.repeat(MAX_PAGE_BYTES), css: 'b' });
    expect(loadEditor()).toBeNull();
    saveRaw({ ...code, html: 'a'.repeat(MAX_PAGE_BYTES - 1), css: 'b' });
    expect(loadEditor()?.html).toHaveLength(MAX_PAGE_BYTES - 1);
  });
});

describe('app store editor persistence', () => {
  const freshStore = async () => {
    vi.resetModules();
    const { store } = await import('../../src/app/store');
    const editor = await import('../../src/features/editor/editorSlice');
    return { store, ...editor };
  };

  it('a store created from storage shows the same html and css', async () => {
    saveEditor({ html: '<p>Mine</p>', css: 'p { color: red }', source: 'paste', fileName: null });
    const { store } = await freshStore();
    expect(store.getState().editor).toMatchObject({
      html: '<p>Mine</p>',
      css: 'p { color: red }',
      source: 'paste',
      saveFailed: false,
    });
  });

  it('shows the sample when the saved code is malformed or oversized', async () => {
    localStorage.setItem(KEY, JSON.stringify({ editor: { html: 1, css: '', source: 'paste' } }));
    expect((await freshStore()).store.getState().editor).toMatchObject({
      html: SAMPLE_HTML,
      css: SAMPLE_CSS,
      source: 'sample',
    });
    saveEditor({ html: 'a'.repeat(MAX_PAGE_BYTES + 1), css: '', source: 'paste', fileName: null });
    expect((await freshStore()).store.getState().editor.source).toBe('sample');
  });

  it('saves the code about 300 ms after the last edit, and survives a new store', async () => {
    const { store, htmlChanged, cssChanged } = await freshStore();
    vi.useFakeTimers();
    store.dispatch(htmlChanged('<p>One</p>'));
    vi.advanceTimersByTime(200);
    store.dispatch(cssChanged('p { margin: 0 }'));
    vi.advanceTimersByTime(200);
    expect(loadEditor()).toBeNull(); // still typing: nothing written yet
    vi.advanceTimersByTime(100);
    expect(loadEditor()).toEqual({
      html: '<p>One</p>',
      css: 'p { margin: 0 }',
      source: 'paste',
      fileName: null,
    });
    vi.useRealTimers();
    const { store: after } = await freshStore();
    expect(after.getState().editor.html).toBe('<p>One</p>');
    expect(after.getState().editor.css).toBe('p { margin: 0 }');
  });

  it('saves the sample like any other code', async () => {
    saveEditor({ html: '<p>Mine</p>', css: '', source: 'paste', fileName: null });
    const { store, sampleLoaded } = await freshStore();
    vi.useFakeTimers();
    store.dispatch(sampleLoaded());
    vi.advanceTimersByTime(300);
    expect(loadEditor()).toEqual({
      html: SAMPLE_HTML,
      css: SAMPLE_CSS,
      source: 'sample',
      fileName: null,
    });
  });

  it('saves a pending edit when the page goes away', async () => {
    const { store, htmlChanged } = await freshStore();
    vi.useFakeTimers();
    store.dispatch(htmlChanged('<p>Quick</p>'));
    window.dispatchEvent(new Event('pagehide'));
    expect(loadEditor()?.html).toBe('<p>Quick</p>');
  });

  it('flags the code as unsaved when saving fails, and clears the flag when it works', async () => {
    const { store, htmlChanged } = await freshStore();
    vi.useFakeTimers();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    store.dispatch(htmlChanged('<p>Lost</p>'));
    vi.advanceTimersByTime(300);
    expect(store.getState().editor.saveFailed).toBe(true);

    setItem.mockRestore();
    store.dispatch(htmlChanged('<p>Kept</p>'));
    vi.advanceTimersByTime(300);
    expect(store.getState().editor.saveFailed).toBe(false);
    expect(loadEditor()?.html).toBe('<p>Kept</p>');
  });
});
