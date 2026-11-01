import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import Workbench from '../../src/features/audit/Workbench';
import { SettingsProvider } from '../../src/context/SettingsContext';
import { makeStore } from '../helpers/store';

// The preview hands the workbench a document straight away, and the audit throws.
vi.mock('../../src/features/audit/SandboxFrame', async () => {
  const { useEffect } = await import('react');
  return {
    default: function FakeFrame({ onDocument }) {
      useEffect(() => {
        const frame = document.createElement('iframe');
        document.body.append(frame);
        onDocument(frame.contentDocument);
        return () => frame.remove();
      }, [onDocument]);
      return null;
    },
  };
});
vi.mock('../../src/engine/scheduler', () => ({
  runRulesSliced: () => Promise.reject(new Error('A rule crashed')),
}));

afterEach(cleanup);
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Workbench audit failure', () => {
  it('stops checking and says what went wrong', async () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <SettingsProvider>
          <MemoryRouter>
            <Workbench />
          </MemoryRouter>
        </SettingsProvider>
      </Provider>,
    );
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The page could not be checked. A rule crashed.');
    expect(alert.textContent).toContain('Edit the code to try again.');
    expect(store.getState().audit.status).toBe('failed');
    expect(screen.getByText('The check failed')).toBeTruthy();
    expect(screen.queryByText('Checking the page…')).toBeNull();
  });
});
