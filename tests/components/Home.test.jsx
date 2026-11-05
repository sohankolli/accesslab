import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import Home from '../../src/features/home/Home';
import { makeStore } from '../helpers/store';

afterEach(cleanup);

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
});

function renderHome() {
  const store = makeStore();

  render(
    <Provider store={store}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </Provider>,
  );

  return store;
}

describe('Home bookmarklet', () => {
  it('sets the bookmarklet URL through the link ref', () => {
    renderHome();

    const link = screen.getByRole('link', { name: 'Check with AccessLab' });

    expect(link.getAttribute('href')).toMatch(/^javascript:/);
    expect(link.getAttribute('href')).toContain('accesslab:ready');
  });

  it('does not execute the bookmarklet when clicked and shows instructions', () => {
    const locationBeforeClick = window.location.href;
    renderHome();

    const link = screen.getByRole('link', { name: 'Check with AccessLab' });

    fireEvent.click(link);

    expect(window.location.href).toBe(locationBeforeClick);
    expect(screen.getByRole('status').textContent).toBe(
      'Drag this link to your bookmarks bar to use it.',
    );
  });

  it('keeps the existing Home page navigation links', () => {
    renderHome();

    expect(screen.getByRole('link', { name: 'Check a page' }).getAttribute('href')).toBe('/audit');

    expect(screen.getByRole('link', { name: 'Try the sample café' }).getAttribute('href')).toBe(
      '/audit',
    );
  });
});
