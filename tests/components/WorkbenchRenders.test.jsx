import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import Workbench from '../../src/features/audit/Workbench';
import { SettingsProvider } from '../../src/context/SettingsContext';
import { auditCompleted } from '../../src/features/audit/auditSlice';
import { makeStore } from '../helpers/store';

// Count how often each issue row renders.
const rowRenders = vi.hoisted(() => ({ count: 0 }));
vi.mock('../../src/features/audit/IssueRow', () => ({
  default: function CountingRow({ issue }) {
    rowRenders.count++;
    return <li>{issue.message}</li>;
  },
}));
// No real preview: the test is about typing, not auditing.
vi.mock('../../src/features/audit/SandboxFrame', () => ({ default: () => null }));

afterEach(cleanup);
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

const issue = (n) => ({
  id: `img-alt:img:nth-of-type(${n})`,
  ruleId: 'img-alt',
  severity: 'critical',
  selector: `img:nth-of-type(${n})`,
  snippet: '<img>',
  message: `Image ${n} has no text alternative`,
  impact: '',
  fix: { text: '' },
  source: { tag: 'img', nth: n - 1 },
});

describe('Workbench typing', () => {
  it('does not re-render the issue rows on a keystroke', () => {
    const store = makeStore();
    store.dispatch(
      auditCompleted({
        ranAt: 1,
        score: 50,
        issues: [issue(1), issue(2), issue(3)],
        timings: {},
        errors: [],
      }),
    );
    const { container } = render(
      <Provider store={store}>
        <SettingsProvider>
          <MemoryRouter>
            <Workbench />
          </MemoryRouter>
        </SettingsProvider>
      </Provider>,
    );
    const before = rowRenders.count;
    expect(before).toBeGreaterThan(0);

    const input = container.querySelector('#html-input');
    fireEvent.change(input, { target: { value: '<p>a</p>' } });
    fireEvent.change(input, { target: { value: '<p>ab</p>' } });

    expect(store.getState().editor.html).toBe('<p>ab</p>');
    expect(rowRenders.count).toBe(before);
  });

  it('refuses a paste over 500 KB with a message, and keeps the code', () => {
    const store = makeStore();
    const { container } = render(
      <Provider store={store}>
        <SettingsProvider>
          <MemoryRouter>
            <Workbench />
          </MemoryRouter>
        </SettingsProvider>
      </Provider>,
    );
    const input = container.querySelector('#html-input');
    const before = input.value;
    fireEvent.change(input, { target: { value: 'a'.repeat(600 * 1024) } });

    expect(screen.getByRole('alert').textContent).toContain(
      'That HTML was not added. It would make the page 601 KB',
    );
    expect(input.value).toBe(before);
    expect(store.getState().editor.html).toBe(before);
  });
});
