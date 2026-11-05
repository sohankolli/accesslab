import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router';
import { makeStore } from '../helpers/store';
import { useOpenBookmarklet } from '../../src/features/editor/useOpenBookmarklet';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(window, 'opener', {
    configurable: true,
    value: null,
  });
});

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
});

function Harness() {
  const [notice, setNotice] = useState(null);
  const notify = useCallback((next) => setNotice(next), []);
  const { search } = useLocation();

  useOpenBookmarklet(notify);

  return (
    <>
      <output data-testid="search">{search}</output>
      {notice && <div role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.body}</div>}
    </>
  );
}

function renderHookAt(url) {
  const store = makeStore();

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[url]}>
        <Harness />
      </MemoryRouter>
    </Provider>,
  );

  return store;
}

function setOpener(opener) {
  Object.defineProperty(window, 'opener', {
    configurable: true,
    value: opener,
  });
}

function sendPage(opener, data) {
  const event = new MessageEvent('message', { data });
  Object.defineProperty(event, 'source', { value: opener });
  window.dispatchEvent(event);
}

describe('useOpenBookmarklet', () => {
  it('opens the received page, removes the query and shows page details', async () => {
    const opener = { postMessage: vi.fn() };
    setOpener(opener);

    const store = renderHookAt('/audit?from=bookmarklet');

    sendPage(opener, {
      type: 'accesslab:page',
      html: '<h1>Example</h1>',
      css: 'h1 { color: red; }',
      title: 'Example Website',
      url: 'https://example.com/page',
      skippedStylesheets: 2,
    });

    await waitFor(() => {
      expect(screen.getByTestId('search').textContent).toBe('');
    });

    expect(
      screen.getByText(
        'Opened Example Website from example.com. 2 stylesheet(s) were skipped because they could not be read.',
      ).textContent,
    ).toBe(
      'Opened Example Website from example.com. 2 stylesheet(s) were skipped because they could not be read.',
    );

    expect(store.getState().editor.html).toBe('<h1>Example</h1>');
    expect(store.getState().editor.css).toBe('h1 { color: red; }');
  });

  it('removes the query and shows an error when the page is not received', async () => {
    const opener = { postMessage: vi.fn() };
    setOpener(opener);

    vi.useFakeTimers();
    renderHookAt('/audit?from=bookmarklet');

    expect(opener.postMessage).toHaveBeenCalledWith({ type: 'accesslab:ready' }, '*');

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId('search').textContent).toBe('');
    expect(screen.getByRole('alert').textContent).toContain('No page was received.');
  });

  it('shows an error and removes the query when there is no opener', async () => {
    setOpener(null);
    renderHookAt('/audit?from=bookmarklet');

    await waitFor(() => {
      expect(screen.getByTestId('search').textContent).toBe('');
    });

    expect(screen.getByRole('alert').textContent).toContain('No page was received.');
  });
});
