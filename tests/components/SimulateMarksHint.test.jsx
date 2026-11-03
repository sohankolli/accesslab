import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import Simulator from '../../src/features/simulate/Simulator';
import { auditCompleted } from '../../src/features/audit/auditSlice';
import { htmlChanged } from '../../src/features/editor/editorSlice';
import { makeStore } from '../helpers/store';

afterEach(cleanup);
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
});

const result = { ranAt: 1, score: 80, issues: [], timings: {}, errors: [] };
const HINT = /Issue marks appear after this page has been checked/;

const show = (store) =>
  render(
    <Provider store={store}>
      <MemoryRouter>
        <Simulator />
      </MemoryRouter>
    </Provider>,
  );

describe('Simulate without an audit of the current code', () => {
  it('says where the marks come from, with a link to the Workbench, and runs no audit', () => {
    const store = makeStore();
    show(store);
    expect(screen.getByText(HINT)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Workbench' }).getAttribute('href')).toBe('/audit');
    expect(store.getState().audit.status).toBe('idle');
    expect(store.getState().audit.result).toBeNull();
    expect(store.getState().history.runs).toHaveLength(0);
  });

  it('shows no hint when the last audit checked exactly this code', () => {
    const store = makeStore();
    const { html, css } = store.getState().editor;
    store.dispatch(auditCompleted(result, { html, css }));
    show(store);
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it('shows the hint again once the code has changed since that audit', () => {
    const store = makeStore();
    const { html, css } = store.getState().editor;
    store.dispatch(auditCompleted(result, { html, css }));
    store.dispatch(htmlChanged('<p>New page</p>'));
    show(store);
    expect(screen.getByText(HINT)).toBeTruthy();
  });
});

describe('auditCompleted', () => {
  it('records the code that was checked alongside the result', () => {
    const store = makeStore();
    store.dispatch(auditCompleted(result, { html: '<p>a</p>', css: '' }));
    expect(store.getState().audit.checked).toEqual({ html: '<p>a</p>', css: '' });
    expect(store.getState().audit.result).toEqual(result);
  });
});
