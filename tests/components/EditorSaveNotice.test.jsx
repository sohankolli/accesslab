import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import Workbench from '../../src/features/audit/Workbench';
import { SettingsProvider } from '../../src/context/SettingsContext';
import { editorSaveResult } from '../../src/features/editor/editorSlice';
import { makeStore } from '../helpers/store';

// No real preview: the test is about the source pane's notice.
vi.mock('../../src/features/audit/SandboxFrame', () => ({ default: () => null }));

afterEach(cleanup);
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
});

const MESSAGE = 'Your code could not be saved in this browser, so it will be lost on refresh.';

const renderWorkbench = (store) =>
  render(
    <Provider store={store}>
      <SettingsProvider>
        <MemoryRouter>
          <Workbench />
        </MemoryRouter>
      </SettingsProvider>
    </Provider>,
  );

describe('Workbench save notice', () => {
  it('says so in the source pane when the code cannot be saved, and clears when it can', () => {
    const store = makeStore();
    renderWorkbench(store);
    expect(screen.queryByText(MESSAGE)).toBeNull();

    act(() => store.dispatch(editorSaveResult(false)));
    const notice = screen.getByText(MESSAGE);
    expect(notice.closest('[role="alert"]')).toBeTruthy();
    expect(notice.closest('#pane-source')).toBeTruthy();

    act(() => store.dispatch(editorSaveResult(true)));
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });
});
