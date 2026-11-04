import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router';
import Workbench from '../../src/features/audit/Workbench';
import { SettingsProvider } from '../../src/context/SettingsContext';
import { encodeShare, MAX_LINK_LENGTH } from '../../src/features/editor/shareLink';
import { htmlChanged } from '../../src/features/editor/editorSlice';
import { makeStore } from '../helpers/store';

// No real preview: these tests are about the source pane.
vi.mock('../../src/features/audit/SandboxFrame', () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
});

// The router's current location, read after each render.
let seen = null;
function Where() {
  const location = useLocation();
  useEffect(() => {
    seen = location;
  });
  return null;
}

function renderAt(url, store = makeStore()) {
  render(
    <Provider store={store}>
      <SettingsProvider>
        <MemoryRouter initialEntries={[url]}>
          <Workbench />
          <Where />
        </MemoryRouter>
      </SettingsProvider>
    </Provider>,
  );
  return store;
}

describe('opening a share link', () => {
  it('loads the code, marks it as from a link and cleans the address', async () => {
    const page = { html: '<main><h1>Café ☕</h1></main>', css: 'h1 { color: navy }' };
    const store = renderAt(`/audit#s=${await encodeShare(page)}`);
    expect(await screen.findByText('Opened a shared page.')).toBeTruthy();
    expect(store.getState().editor).toMatchObject({ ...page, source: 'link', fileName: null });
    expect(screen.getByLabelText('HTML source').value).toBe(page.html);
    await waitFor(() => expect(seen.hash).toBe(''));
    expect(seen.pathname).toBe('/audit');
  });

  it('shows the sample and says so when the link is damaged', async () => {
    const data = await encodeShare({ html: '<p>'.repeat(400), css: '' });
    const store = renderAt(`/audit#s=${data.slice(0, 20)}`);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(
      'This share link is damaged or incomplete, so the sample page is shown.',
    );
    expect(store.getState().editor.source).toBe('sample');
    await waitFor(() => expect(seen.hash).toBe(''));
  });

  it('keeps the user’s code when a damaged link is opened over it', async () => {
    const store = makeStore();
    store.dispatch(htmlChanged('<p>mine</p>'));
    renderAt('/audit#s=***', store);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('so your code was left as it was');
    expect(store.getState().editor.html).toBe('<p>mine</p>');
  });

  it('ignores fragments that are not share links', () => {
    const store = renderAt('/audit#main');
    expect(store.getState().editor.source).toBe('sample');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Copy share link', () => {
  it('copies a link to this page and says "Link copied"', async () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderAt('/audit');
    fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
    expect(await screen.findByText('Link copied')).toBeTruthy();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toMatch(/\/audit#s=[A-Za-z0-9_-]+$/);
  });

  it('shows the link selected in a field when the clipboard is refused', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderAt('/audit');
    fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
    const field = await screen.findByLabelText(/Copy it with Ctrl\+C/);
    expect(field.readOnly).toBe(true);
    expect(field.value).toMatch(/\/audit#s=/);
    expect(document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(field.value.length);
  });

  it('does not make a link over the length limit, and suggests the file', async () => {
    const writeText = vi.fn().mockResolvedValue();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const store = makeStore();
    let seed = 1;
    let noise = '';
    while (noise.length < MAX_LINK_LENGTH * 2) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      noise += seed.toString(36);
    }
    store.dispatch(htmlChanged(noise));
    renderAt('/audit', store);
    fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('This page is too big for a share link.');
    expect(alert.textContent).toContain(`It is ${Math.ceil(noise.length / 1024)} KB`);
    expect(alert.textContent).toContain('Share the .html file instead.');
    expect(writeText).not.toHaveBeenCalled();
  });
});
