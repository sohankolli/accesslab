import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import Report from '../../src/features/report/Report';
import { historySaveResult } from '../../src/features/report/historySlice';
import { makeStore } from '../helpers/store';

afterEach(cleanup);

const renderReport = (store) =>
  render(
    <Provider store={store}>
      <MemoryRouter>
        <Report />
      </MemoryRouter>
    </Provider>,
  );

describe('Report save notice', () => {
  it('says when history cannot be saved', () => {
    const store = makeStore();
    store.dispatch(historySaveResult(false));
    renderReport(store);
    expect(screen.getByText('History can’t be saved in this browser.')).toBeTruthy();
  });

  it('says nothing while saving works', () => {
    renderReport(makeStore());
    expect(screen.queryByText(/can’t be saved/)).toBeNull();
  });
});
