import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import FindingsPane from '../../src/features/audit/FindingsPane';
import { SettingsProvider } from '../../src/context/SettingsContext';
import { auditCompleted } from '../../src/features/audit/auditSlice';
import { runAdded } from '../../src/features/report/historySlice';
import { pageOf } from '../../src/features/report/pages';
import { makeStore } from '../helpers/store';

afterEach(cleanup);
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
});

/** What the workbench does after each audit: show the result and save the run. */
function check(store, ranAt, score, title) {
  const result = { ranAt, score, issues: [], timings: {}, errors: [], page: pageOf({ title }) };
  store.dispatch(auditCompleted(result));
  store.dispatch(runAdded(result));
}

const deltaText = (store) => {
  const { container } = render(
    <Provider store={store}>
      <SettingsProvider>
        <MemoryRouter>
          <FindingsPane
            hasRules
            onFixApplied={() => {}}
            onShowIssue={() => {}}
            onShowInCode={() => {}}
          />
        </MemoryRouter>
      </SettingsProvider>
    </Provider>,
  );
  const text = container.querySelector('.delta').textContent;
  cleanup();
  return text;
};

describe('Workbench "since the last check"', () => {
  it('compares with the last run of the same page, never another page', () => {
    const store = makeStore();
    check(store, 1, 70, 'Café Aroma menu');
    expect(deltaText(store)).toBe('First check of this page');

    check(store, 2, 100, 'Contact us');
    expect(deltaText(store)).toBe('First check of this page');

    check(store, 3, 82, 'Café Aroma menu');
    expect(deltaText(store)).toBe('Up 12 since the last check');
  });
});
