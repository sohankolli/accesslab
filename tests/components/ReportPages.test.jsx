import { describe, it, expect, afterEach, beforeAll } from 'vitest';
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
