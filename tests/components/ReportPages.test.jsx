import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router';
import Report from '../../src/features/report/Report';
import { pageOf } from '../../src/features/report/pages';
import { makeStore } from '../helpers/store';

afterEach(cleanup);
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
});

const run = (ranAt, score, title) => ({
  id: String(ranAt),
  ranAt,
  score,
  counts: {},
  issues: [],
  ...(title ? { page: pageOf({ title }) } : {}),
});

// Newest first, as stored: the café was checked last; two runs are from before pages.
const RUNS = [
  run(1793610005000, 90, 'Café Aroma menu'),
  run(1793610004000, 100, 'Contact us'),
  run(1793610003000, 80, 'Café Aroma menu'),
  run(1793610002000, 70, 'Café Aroma menu'),
  run(1793610001000, 40),
  run(1793610000000, 30),
];

function renderReport(path = '/report', runs = RUNS) {
  const store = makeStore({ history: { runs, saveFailed: false } });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/report" element={<Report />} />
          <Route path="/report/:runId" element={<Report />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  return store;
}

const pageSelect = () => screen.getByRole('combobox', { name: 'Page' });
const historyRows = () =>
  within(screen.getByRole('table', { name: /newest first/ }))
    .getAllByRole('row')
    .slice(1);
const optionsOf = (name) =>
  within(screen.getByRole('combobox', { name }))
    .getAllByRole('option')
    .map((o) => o.value);

describe('Report by page', () => {
  it('lists each page with its number of runs and shows the latest page by default', () => {
    renderReport();
    const options = within(pageSelect())
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(options).toEqual([
      'Café Aroma menu (3 runs)',
      'Contact us (1 run)',
      'Earlier checks (2 runs)',
    ]);
    expect(pageSelect().value).toBe('page:café aroma menu');
  });

  it('shows only the chosen page in the history and both "Before and after" selects', () => {
    renderReport();
    const cafe = ['1793610005000', '1793610003000', '1793610002000'];
    expect(historyRows()).toHaveLength(3);
    expect(optionsOf('Before')).toEqual(cafe);
    expect(optionsOf('After')).toEqual(cafe);
    expect(screen.getByRole('combobox', { name: 'After' }).value).toBe(cafe[0]);
    expect(screen.getByRole('combobox', { name: 'Before' }).value).toBe(cafe[1]);
    expect(screen.getByText(/over 3 checks/)).toBeTruthy(); // the trend's caption

    fireEvent.change(pageSelect(), { target: { value: 'earlier' } });
    expect(historyRows()).toHaveLength(2);
    expect(optionsOf('After')).toEqual(['1793610001000', '1793610000000']);
    expect(screen.getByText('Showing 2 runs of Earlier checks.')).toBeTruthy(); // live region
  });

  it('says to check again when a page has only one run', () => {
    renderReport();
    expect(screen.queryByText('Check this page again to compare.')).toBeNull();
    fireEvent.change(pageSelect(), { target: { value: 'page:contact us' } });
    expect(screen.getByText('Check this page again to compare.')).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'Before' })).toBeNull();
    expect(historyRows()).toHaveLength(1);
  });

  it('opening /report/<run> selects that run’s page', () => {
    renderReport('/report/1793610004000');
    expect(pageSelect().value).toBe('page:contact us');
    renderReport('/report/1793610000000');
    expect(screen.getAllByRole('combobox', { name: 'Page' })[1].value).toBe('earlier');
  });
});

describe('Clear history', () => {
  const clearButton = () => screen.getByRole('button', { name: 'Clear history' });
  const open = () => {
    fireEvent.click(clearButton());
    return screen.getByRole('group', { name: 'Clear history?' });
  };

  it('asks inside the page, with focus on the question', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderReport();
    expect(clearButton().getAttribute('aria-expanded')).toBe('false');
    const panel = open();
    expect(document.activeElement).toBe(panel);
    expect(clearButton().getAttribute('aria-expanded')).toBe('true');
    expect(panel.textContent).toContain('Clear the 3 runs of Café Aroma menu, or all 6 runs');
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('Esc and Cancel close it, keep the history and return focus to the button', () => {
    const store = renderReport();
    const panel = open();
    fireEvent.keyDown(within(panel).getByRole('button', { name: 'Clear all pages' }), {
      key: 'Escape',
    });
    expect(screen.queryByRole('group', { name: 'Clear history?' })).toBeNull();
    expect(document.activeElement).toBe(clearButton());

    fireEvent.click(within(open()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Clear history?' })).toBeNull();
    expect(document.activeElement).toBe(clearButton());
    expect(store.getState().history.runs).toHaveLength(6);
  });

  it('"Clear this page" clears only this page and shows the next one', () => {
    const store = renderReport();
    fireEvent.click(within(open()).getByRole('button', { name: 'Clear this page' }));
    const left = store.getState().history.runs;
    expect(left).toHaveLength(3);
    expect(left.some((r) => r.page?.name === 'Café Aroma menu')).toBe(false);
    expect(pageSelect().value).toBe('page:contact us');
    expect(
      screen.getByText('Cleared the history of Café Aroma menu. Showing 1 run of Contact us.'),
    ).toBeTruthy();
    expect(document.activeElement).toBe(clearButton());
  });

  it('"Clear all pages" clears everything and focuses the empty state', () => {
    const store = renderReport();
    fireEvent.click(within(open()).getByRole('button', { name: 'Clear all pages' }));
    expect(store.getState().history.runs).toEqual([]);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'No checks yet' }));
  });

  it('"Clear this page" on the only page leaves the empty state', () => {
    const store = renderReport('/report', RUNS.slice(1, 2));
    fireEvent.click(within(open()).getByRole('button', { name: 'Clear this page' }));
    expect(store.getState().history.runs).toEqual([]);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'No checks yet' }));
  });
});
