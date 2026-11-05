import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import historyReducer, {
  runAdded,
  repeatedRun,
  selectPreviousScore,
} from '../../src/features/report/historySlice';
import { codeHash } from '../../src/features/report/codeHash';
import { pageOf } from '../../src/features/report/pages';
import { useAudit } from '../../src/features/audit/useAudit';
import { SettingsProvider } from '../../src/context/SettingsContext';
import { loadHistory, saveHistory } from '../../src/services/storage';
import { makeStore } from '../helpers/store';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const menu = pageOf({ title: 'Menu' });
const check = (ranAt, score, hash, page = menu) => ({
  ranAt,
  score,
  issues: [],
  timings: {},
  errors: [],
  page,
  ...(hash ? { codeHash: hash } : {}),
});

describe('codeHash', () => {
  it('is short and stable, and changes with the code', () => {
    expect(codeHash('<p>a</p>', 'p{}')).toMatch(/^[0-9a-f]{8}$/);
    expect(codeHash('<p>a</p>', 'p{}')).toBe(codeHash('<p>a</p>', 'p{}'));
    expect(codeHash('<p>a</p>', 'p{}')).not.toBe(codeHash('<p>a</p>', 'p{ }'));
    expect(codeHash('ab', '')).not.toBe(codeHash('a', 'b')); // the tab matters
  });
});

describe('history: the same code checked again', () => {
  it('does not add a run when the page’s last run has the same code', () => {
    let state = historyReducer(undefined, runAdded(check(1, 70, 'aaaa')));
    state = historyReducer(state, runAdded(check(2, 70, 'aaaa')));
    expect(state.runs.map((r) => r.ranAt)).toEqual([1]);
    expect(state.runs[0].codeHash).toBe('aaaa');
  });

  it('adds a run after a real edit, and when the score changed (a rule pack toggled)', () => {
    let state = historyReducer(undefined, runAdded(check(1, 70, 'aaaa')));
    state = historyReducer(state, runAdded(check(2, 82, 'bbbb')));
    state = historyReducer(state, runAdded(check(3, 90, 'bbbb')));
    expect(state.runs.map((r) => r.ranAt)).toEqual([3, 2, 1]);
  });

  it('only compares with the same page’s latest run', () => {
    let state = historyReducer(undefined, runAdded(check(1, 70, 'aaaa')));
    state = historyReducer(state, runAdded(check(2, 70, 'aaaa', pageOf({ title: 'Other' }))));
    expect(state.runs).toHaveLength(2);
    // Back to A after B: B is the latest, so checking A again is a new run.
    state = historyReducer(undefined, runAdded(check(1, 70, 'aaaa')));
    state = historyReducer(state, runAdded(check(2, 80, 'bbbb')));
    state = historyReducer(state, runAdded(check(3, 70, 'aaaa')));
    expect(state.runs).toHaveLength(3);
  });

  it('keeps old runs without a hash working', () => {
    saveHistory({ runs: [{ id: '1', ranAt: 1, score: 70, counts: {}, page: menu }] });
    const [old] = loadHistory().runs;
    expect(old.codeHash).toBeUndefined();
    const state = historyReducer({ runs: [old], saveFailed: false }, runAdded(check(2, 70, 'aa')));
    expect(state.runs).toHaveLength(2); // an old run never counts as a repeat
    expect(repeatedRun([old], check(3, 70))).toBeUndefined();
  });

  it('drops saved runs whose hash is not a string', () => {
    saveHistory({ runs: [{ id: '1', ranAt: 1, score: 70, counts: {}, codeHash: 5 }] });
    expect(loadHistory().runs).toEqual([]);
  });
});

/** The workbench's audit, run for real on a small page. */
function auditor(store, initial) {
  const wrapper = ({ children }) => (
    <Provider store={store}>
      <SettingsProvider>{children}</SettingsProvider>
    </Provider>
  );
  const docRef = { current: null };
  return renderHook((code) => useAudit({ docRef, ...code }), { wrapper, initialProps: initial });
}

function pageDoc(html, css) {
  const doc = document.implementation.createHTMLDocument('Menu');
  doc.body.innerHTML = html;
  const style = doc.createElement('style');
  style.textContent = css;
  doc.head.append(style);
  return doc;
}

describe('useAudit: refresh does not duplicate runs', () => {
  it('checks the same code again without a new run, then adds one after an edit', async () => {
    const before = { html: '<main><h1>Menu</h1><img src="a.png"></main>', css: 'h1 {}' };
    const edited = { html: '<main><h1>Menu</h1><img src="a.png" alt="Tea"></main>', css: 'h1 {}' };

    // An earlier check with another score, so "since the last check" has something to show.
    const store = makeStore();
    store.dispatch(runAdded(check(1, 10, 'old')));

    const first = auditor(store, before);
    await act(() => first.result.current.auditDocument(pageDoc(before.html, before.css)));
    expect(store.getState().history.runs).toHaveLength(2);
    const firstRun = store.getState().history.runs[0];
    const delta = selectPreviousScore(store.getState());
    expect(delta).toBe(10);
    first.unmount();

    // A refresh: a new workbench audits the same code.
    const again = auditor(store, before);
    await act(() => again.result.current.auditDocument(pageDoc(before.html, before.css)));
    expect(store.getState().history.runs).toHaveLength(2);
    expect(store.getState().audit.result.ranAt).toBe(firstRun.ranAt);
    expect(selectPreviousScore(store.getState())).toBe(delta); // the same "since the last check"

    // A real edit adds a run.
    again.rerender(edited);
    await act(() => again.result.current.auditDocument(pageDoc(edited.html, edited.css)));
    const runs = store.getState().history.runs;
    expect(runs).toHaveLength(3);
    expect(runs[0].codeHash).toBe(codeHash(edited.html, edited.css));
    expect(runs[0].codeHash).not.toBe(firstRun.codeHash);
  });
});
