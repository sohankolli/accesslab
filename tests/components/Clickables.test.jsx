import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { useRef } from 'react';
import FindingsPane from '../../src/features/audit/FindingsPane';
import ModelSwitch from '../../src/features/audit/ModelSwitch';
import { SettingsProvider } from '../../src/context/SettingsContext';
import { auditCompleted } from '../../src/features/audit/auditSlice';
import {
  checkCompleted,
  manifestLoaded,
  modelSwitched,
  modelUnavailable,
  selectMarkedFindings,
} from '../../src/features/audit/clickablesSlice';
import { findClickOnly, useClickables } from '../../src/features/audit/useClickables';
import { modelClient, resetModelClient } from '../../src/engine/ml/client';
import { makeStore } from '../helpers/store';

const ruleIssue = {
  id: 'img-alt:img',
  ruleId: 'img-alt',
  severity: 'critical',
  selector: 'img',
  snippet: '<img>',
  message: 'The image has no text alternative',
  impact: 'Screen reader users hear "image" and nothing else.',
  fix: { text: 'Add alt' },
  source: { tag: 'img', nth: 0 },
};
const suggestion = {
  id: 'ml:body > div',
  key: 'body > div|abc',
  ruleId: 'click-only',
  severity: 'advisory',
  selector: 'body > div',
  snippet: '<div class="btn">Buy</div>',
  tag: 'div',
  p: 0.92,
  cues: [{ id: 'pointer', text: 'pointer cursor' }],
  source: { tag: 'div', nth: 0 },
  x: [0, 1],
};

function setup() {
  const store = makeStore();
  store.dispatch(
    auditCompleted({ ranAt: 1, score: 77, issues: [ruleIssue], timings: {}, errors: [] }),
  );
  store.dispatch(manifestLoaded({ version: '1.0.0', threshold: 0.8, defaultOn: true }));
  store.dispatch(
    checkCompleted({
      findings: [suggestion],
      timing: { elements: 10, featuresMs: 1, modelMs: 2 },
    }),
  );
  render(
    <Provider store={store}>
      <SettingsProvider>
        <MemoryRouter>
          <FindingsPane hasRules headingRef={{ current: null }} onShowIssue={() => {}} />
        </MemoryRouter>
      </SettingsProvider>
    </Provider>,
  );
  return store;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetModelClient();
});

describe('model suggestions in the findings pane', () => {
  it('are listed as advisory and never change the score or the history', () => {
    const store = setup();
    expect(screen.getByText('Possibly click-only')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Looks like a button but is not one \(92%\)/ }),
    ).toBeTruthy();
    expect(store.getState().audit.result.score).toBe(77);
    expect(store.getState().audit.result.issues).toHaveLength(1);
    expect(store.getState().history.runs).toHaveLength(0);
    // Numbered on after the rule findings, and marked on the preview after them.
    expect(selectMarkedFindings(store.getState()).map((f) => f.id)).toEqual([
      ruleIssue.id,
      suggestion.id,
    ]);
  });

  it('labels the suggestions as low confidence, and as never changing the score', () => {
    const store = setup();
    act(() => store.dispatch(modelSwitched(true)));
    const note = document.querySelector('.group--advisory .group__note');
    expect(note.querySelector('strong').textContent).toBe(
      'Low confidence: the model is experimental.',
    );
    expect(note.textContent).toMatch(/Suggestions never change the score\./);
    expect(
      screen.getByText(/Checked 10 elements in 2 ms\. Low confidence: the model is experimental\./),
    ).toBeTruthy();
  });

  it('opens with the cues, the fix and the actions, all as buttons', () => {
    const store = setup();
    act(() => store.dispatch({ type: 'audit/issueSelected', payload: suggestion.id }));
    expect(screen.getByText('pointer cursor')).toBeTruthy();
    expect(screen.getByText(/role="button" tabindex="0"/)).toBeTruthy();
    for (const name of ['Copy the fix', 'Not an issue']) {
      expect(screen.getByRole('button', { name }).tagName).toBe('BUTTON');
    }
  });

  it('"Not an issue" hides the suggestion, keeps a record, and offers the export', () => {
    const store = setup();
    act(() => store.dispatch({ type: 'audit/issueSelected', payload: suggestion.id }));
    fireEvent.click(screen.getByRole('button', { name: 'Not an issue' }));
    expect(screen.queryByText('Possibly click-only')).toBeNull();
    expect(store.getState().clickables.dismissed).toEqual([
      expect.objectContaining({
        key: suggestion.key,
        selector: suggestion.selector,
        p: 0.92,
        x: [0, 1],
      }),
    ]);
    expect(screen.getByRole('button', { name: 'Export as JSON' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show them again' }));
    expect(screen.getByText('Possibly click-only')).toBeTruthy();
  });

  it('the switch turns suggestions off without touching the rule findings', () => {
    const store = setup();
    fireEvent.click(screen.getByLabelText('Suggestions from the model'));
    expect(screen.queryByText('Possibly click-only')).toBeNull();
    expect(screen.getByText('The image has no text alternative')).toBeTruthy();
    expect(store.getState().clickables.enabled).toBe(false);
  });

  it('says the model is not accurate enough yet before and after a check without a threshold', () => {
    const store = makeStore();
    store.dispatch(manifestLoaded({ version: '1.0.0', threshold: null, defaultOn: false }));
    store.dispatch(modelSwitched(true));
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ModelSwitch />
        </MemoryRouter>
      </Provider>,
    );
    expect(
      screen.getByText(
        /^The model is not accurate enough yet to make suggestions\. Suggestions never/,
      ),
    ).toBeTruthy();
  });

  it('says the model is not accurate enough yet when it has no threshold, and suggests nothing', () => {
    const store = setup();
    act(() => {
      store.dispatch(manifestLoaded({ version: '1.0.0', threshold: null, defaultOn: false }));
      store.dispatch(modelSwitched(true));
      store.dispatch(
        checkCompleted({ findings: [], timing: { elements: 10, featuresMs: 1, modelMs: 2 } }),
      );
    });
    expect(
      screen.getByText(
        /Checked 10 elements in 2 ms\. The model is not accurate enough yet to make suggestions\./,
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Possibly click-only')).toBeNull();
    expect(store.getState().audit.result.score).toBe(77);
  });

  it('says plainly when the model is unavailable, and the rules carry on', () => {
    const store = setup();
    act(() => store.dispatch(modelUnavailable('The model file could not be loaded (HTTP 404).')));
    expect(screen.getByText(/Model suggestions are unavailable/)).toBeTruthy();
    expect(screen.getByLabelText('Suggestions from the model').disabled).toBe(true);
    expect(screen.queryByText('Possibly click-only')).toBeNull();
    expect(screen.getByText('The image has no text alternative')).toBeTruthy();
  });
});

describe('saved in this browser', () => {
  function Harness() {
    const docRef = useRef(null);
    useClickables(docRef);
    return null;
  }

  it('"Not an issue" records and the switch survive a reload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }));
    const store = makeStore();
    render(
      <Provider store={store}>
        <Harness />
      </Provider>,
    );
    act(() => {
      store.dispatch({ type: 'clickables/notAnIssue', payload: suggestion });
      store.dispatch({ type: 'clickables/modelSwitched', payload: false });
    });
    const reloaded = makeStore(); // the slice reads its saved state when created
    expect(reloaded.getState().clickables.dismissed[0].key).toBe(suggestion.key);
    expect(reloaded.getState().clickables.enabled).toBe(false);
  });

  it('a missing manifest makes suggestions unavailable, not an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }));
    const store = makeStore();
    await act(async () => {
      render(
        <Provider store={store}>
          <Harness />
        </Provider>,
      );
    });
    expect(store.getState().clickables.status).toBe('unavailable');
    expect(store.getState().clickables.message).toMatch(/HTTP 404/);
  });
});

describe('model worker client', () => {
  it('reports why when the worker cannot start', async () => {
    const client = modelClient(() => {
      throw new Error('Workers are disabled');
    });
    await expect(client.ready).rejects.toThrow(
      'The model worker could not start: Workers are disabled',
    );
  });

  it('passes the worker\'s "unavailable" message on', async () => {
    const worker = {
      postMessage() {
        queueMicrotask(() =>
          worker.onmessage({ data: { type: 'unavailable', message: 'No model' } }),
        );
      },
    };
    await expect(modelClient(() => worker).ready).rejects.toThrow('No model');
  });
});

describe('scoring a page', () => {
  const doc = () => {
    document.body.innerHTML = '<div class="btn" style="cursor:pointer">Buy</div><span>Hi</span>';
    return document;
  };
  // Every element gets a probability of 0.99.
  const client = {
    score: vi.fn(async (rows) => ({ p: new Float32Array(rows.length / 552).fill(0.99), ms: 1 })),
  };

  it('suggests elements at or above the threshold', async () => {
    const { findings } = await findClickOnly(doc(), client, 0.5);
    expect(findings.length).toBeGreaterThan(0);
  });

  it('runs the model but suggests nothing when no threshold was reached', async () => {
    client.score.mockClear();
    const { findings, timing } = await findClickOnly(doc(), client, null);
    expect(findings).toEqual([]);
    expect(client.score).toHaveBeenCalledTimes(1);
    expect(timing.elements).toBeGreaterThan(0);
  });
});
