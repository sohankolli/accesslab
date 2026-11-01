import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import Simulator from '../../src/features/simulate/Simulator';
import Workbench from '../../src/features/audit/Workbench';
import { SettingsProvider } from '../../src/context/SettingsContext';
import { auditCompleted, simulationChanged } from '../../src/features/audit/auditSlice';
import { runAdded } from '../../src/features/report/historySlice';
import { SIMULATIONS } from '../../src/features/simulate/simulations';
import { makeStore } from '../helpers/store';

// Count the audited frame's renders and keep the props it was given.
const frame = vi.hoisted(() => ({ renders: 0, props: null }));
vi.mock('../../src/features/audit/SandboxFrame', async (importOriginal) => ({
  ...(await importOriginal()),
  default: function RecordingFrame(props) {
    frame.renders++;
    frame.props = props;
    return null;
  },
}));

afterEach(cleanup);
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

const audit = {
  ranAt: 1,
  score: 73,
  issues: [],
  timings: {},
  errors: [],
};

function auditedStore() {
  const store = makeStore();
  store.dispatch(auditCompleted(audit));
  store.dispatch(runAdded(audit));
  return store;
}

describe('lenses never change the audit', () => {
  it('switching every lens on the Simulate page keeps the score and the history', () => {
    const store = auditedStore();
    const before = store.getState();
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Simulator />
        </MemoryRouter>
      </Provider>,
    );
    const select = screen.getByLabelText('Visual simulation');
    for (const { value } of [...SIMULATIONS, SIMULATIONS[0]]) {
      fireEvent.change(select, { target: { value } });
      expect(store.getState().audit.simulation).toBe(value);
    }
    const after = store.getState();
    expect(after.audit.result).toBe(before.audit.result);
    expect(after.audit.result.score).toBe(73);
    expect(after.audit.status).toBe(before.audit.status);
    expect(after.history.runs).toEqual(before.history.runs);
    expect(after.history.runs).toHaveLength(1);
  });

  it('the Simulate preview is built without any lens in its source', () => {
    const store = auditedStore();
    store.dispatch(simulationChanged('zoom-200'));
    const { container } = render(
      <Provider store={store}>
        <MemoryRouter>
          <Simulator />
        </MemoryRouter>
      </Provider>,
    );
    const srcdoc = container.querySelector('iframe').getAttribute('srcdoc');
    expect(srcdoc).not.toMatch(/200%/);
  });

  it('a lens change does not re-render the audited frame or add a run', () => {
    const store = auditedStore();
    render(
      <Provider store={store}>
        <SettingsProvider>
          <MemoryRouter>
            <Workbench />
          </MemoryRouter>
        </SettingsProvider>
      </Provider>,
    );
    const renders = frame.renders;
    const props = frame.props;
    expect(props).not.toHaveProperty('simulation');
    for (const { value } of SIMULATIONS) {
      act(() => {
        store.dispatch(simulationChanged(value));
      });
    }
    expect(frame.renders).toBe(renders);
    expect(store.getState().audit.result.score).toBe(73);
    expect(store.getState().history.runs).toHaveLength(1);
  });
});
