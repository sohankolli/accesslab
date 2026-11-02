import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import Workbench from '../../src/features/audit/Workbench';
import { SettingsProvider } from '../../src/context/SettingsContext';
import { MAX_PAGE_BYTES } from '../../src/features/editor/editorSlice';
import {
  langOfFile,
  looksLikeText,
  readPageFile,
  relativeStylesheets,
} from '../../src/features/editor/fileImport';
import { makeStore } from '../helpers/store';

// No real preview: these tests are about the source pane.
vi.mock('../../src/features/audit/SandboxFrame', () => ({ default: () => null }));

afterEach(cleanup);
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
});

const PAGE =
  '<!doctype html><html lang="en"><title>Café</title><main><h1>Menu ☕</h1></main></html>';

/** A store that records every action, to see which actions an import dispatches. */
function renderWorkbench() {
  const store = makeStore();
  const actions = [];
  const dispatch = store.dispatch;
  store.dispatch = (action) => {
    actions.push(action);
    return dispatch(action);
  };
  render(
    <Provider store={store}>
      <SettingsProvider>
        <MemoryRouter initialEntries={['/audit']}>
          <Workbench />
        </MemoryRouter>
      </SettingsProvider>
    </Provider>,
  );
  return { store, actions };
}

/** Choose files in the hidden picker, as the browser does after "Open file". */
async function pick(...files) {
  const input = document.querySelector('input[type="file"]');
  await act(async () => {
    fireEvent.change(input, { target: { files } });
  });
}

describe('file helpers', () => {
  it('knows which tab a file goes in', () => {
    expect(langOfFile('index.HTML')).toBe('html');
    expect(langOfFile('old.htm')).toBe('html');
    expect(langOfFile('site.min.css')).toBe('css');
    expect(langOfFile('app.js')).toBeNull();
    expect(langOfFile('README')).toBeNull();
  });

  it('tells text from binary', () => {
    expect(looksLikeText('<p>héllo 👋</p>')).toBe(true);
    expect(looksLikeText('PNG\0\0')).toBe(false);
    expect(looksLikeText('caf�')).toBe(false);
  });

  it('finds stylesheets linked by a relative path only', () => {
    const html = `<link rel="stylesheet" href="style.css">
      <link rel="preload stylesheet" href="/css/site.css">
      <link rel="stylesheet" href="https://cdn.example/x.css">
      <link rel="stylesheet" href="//cdn.example/y.css">
      <link rel="icon" href="favicon.ico">`;
    expect(relativeStylesheets(html)).toEqual(['style.css', '/css/site.css']);
  });

  it('refuses a file over the cap without reading it', async () => {
    const file = new File(['x'], 'big.html');
    Object.defineProperty(file, 'size', { value: MAX_PAGE_BYTES + 1 });
    file.text = vi.fn();
    expect(await readPageFile(file)).toEqual({
      ok: false,
      reason: 'too-big',
      lang: 'html',
      bytes: MAX_PAGE_BYTES + 1,
    });
    expect(file.text).not.toHaveBeenCalled();
  });
});

describe('Open file', () => {
  it('is a labelled button, and the picker takes .html, .htm and .css', () => {
    renderWorkbench();
    expect(screen.getByRole('button', { name: 'Open file' })).toBeTruthy();
    expect(document.querySelector('input[type="file"]').accept).toBe('.html,.htm,.css');
  });

  it('opens an HTML file into the HTML tab through the typing action', async () => {
    const { store, actions } = renderWorkbench();
    await pick(new File([PAGE], 'café.html', { type: 'text/html' }));
    await screen.findByText('Opened café.html.');
    expect(store.getState().editor).toMatchObject({
      html: PAGE,
      source: 'file',
      fileName: 'café.html',
    });
    expect(screen.getByLabelText('HTML source').value).toBe(PAGE);
    expect(screen.getByText('café.html', { selector: '.src-head__name' })).toBeTruthy();
    const edit = actions.find((a) => a.type === 'editor/htmlChanged');
    expect(edit).toEqual({
      type: 'editor/htmlChanged',
      payload: PAGE,
      meta: { source: 'file', fileName: 'café.html' },
    });
  });

  it('opens a CSS file into the CSS tab and shows that tab', async () => {
    const { store } = renderWorkbench();
    await pick(new File(['h1 { color: navy }'], 'style.css', { type: 'text/css' }));
    await screen.findByText('Opened style.css.');
    expect(store.getState().editor).toMatchObject({
      css: 'h1 { color: navy }',
      source: 'file',
      fileName: 'style.css',
    });
    expect(screen.getByRole('tab', { name: 'CSS' }).getAttribute('aria-selected')).toBe('true');
  });

  it('refuses a file over the cap with the same message as an oversized paste', async () => {
    const { store } = renderWorkbench();
    const before = store.getState().editor.html;
    await pick(new File(['<p>' + 'a'.repeat(MAX_PAGE_BYTES) + '</p>'], 'huge.html'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('That HTML was not added.');
    expect(alert.textContent).toContain('AccessLab checks pages up to 500 KB');
    expect(store.getState().editor.html).toBe(before);
    expect(store.getState().editor.source).toBe('sample');
  });

  it('clears an earlier size notice when another file is opened', async () => {
    const { store } = renderWorkbench();
    await pick(new File(['a'.repeat(MAX_PAGE_BYTES + 1)], 'huge.html'));
    expect(store.getState().editor.rejected).not.toBeNull();
    await pick(new File(['x'], 'app.js'));
    expect(store.getState().editor.rejected).toBeNull();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('says which types work when given another type', async () => {
    const { store } = renderWorkbench();
    await pick(new File(['console.log(1)'], 'app.js'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(
      'app.js was not opened. AccessLab opens .html, .htm and .css files.',
    );
    expect(store.getState().editor.source).toBe('sample');
  });

  it('refuses a file that is not text', async () => {
    renderWorkbench();
    await pick(new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0xff])], 'logo.html'));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('logo.html was not opened: it is not a UTF-8 text file.');
    expect(alert.textContent).toContain('AccessLab opens .html, .htm and .css files.');
  });

  it('tips that a relatively linked stylesheet is not loaded', async () => {
    renderWorkbench();
    const html = '<html><head><link rel="stylesheet" href="style.css"></head><body></body></html>';
    await pick(new File([html], 'index.html'));
    const tip = await screen.findByText(/linked files are not loaded/);
    expect(tip.textContent).toBe(
      'Opened index.html. Tip: this page links style.css, and linked files are not loaded. ' +
        'Open the .css file too, or paste it in the CSS tab.',
    );
  });

  it('gives no tip when the stylesheet is opened with the page', async () => {
    const { store } = renderWorkbench();
    const html = '<link rel="stylesheet" href="style.css"><p>Hi</p>';
    await pick(new File(['p { margin: 0 }'], 'style.css'), new File([html], 'index.html'));
    await screen.findByText('Opened index.html and style.css.');
    expect(screen.queryByText(/linked files are not loaded/)).toBeNull();
    expect(store.getState().editor).toMatchObject({ html, css: 'p { margin: 0 }' });
  });

  it('typing and the size check still work after an import', async () => {
    const { store } = renderWorkbench();
    await pick(new File([PAGE], 'café.html'));
    await screen.findByText('Opened café.html.');
    const ta = screen.getByLabelText('HTML source');
    fireEvent.change(ta, { target: { value: PAGE + '<p>more</p>' } });
    expect(store.getState().editor.html).toBe(PAGE + '<p>more</p>');
    expect(store.getState().editor).toMatchObject({ source: 'file', fileName: 'café.html' });
    fireEvent.change(ta, { target: { value: 'a'.repeat(MAX_PAGE_BYTES + 1) } });
    expect(store.getState().editor.html).toBe(PAGE + '<p>more</p>');
    expect(store.getState().editor.rejected).toMatchObject({ lang: 'html' });
  });
});

describe('help for framework apps', () => {
  it('sits by Open file and says how to check the rendered page', () => {
    renderWorkbench();
    const summary = screen.getByText('Checking a React, Vue or Angular app?');
    const details = summary.closest('details');
    expect(details.closest('.src-head')).toBe(screen.getByText('Open file').closest('.src-head'));
    expect(details.textContent).toContain('Copy outerHTML');
    expect(details.textContent).toContain('AccessLab checks the rendered page.');
  });
});

describe('dropping a file on the editor', () => {
  it('shows a drop target while a file is dragged over, and opens the dropped file', async () => {
    const { store } = renderWorkbench();
    const pane = document.getElementById('pane-source');
    const file = new File([PAGE], 'dropped.html');
    const dataTransfer = { types: ['Files'], files: [file], dropEffect: 'none' };
    fireEvent.dragEnter(pane, { dataTransfer });
    expect(screen.getByText('Drop an .html or .css file to open it')).toBeTruthy();
    await act(async () => {
      fireEvent.drop(pane, { dataTransfer });
    });
    expect(screen.queryByText('Drop an .html or .css file to open it')).toBeNull();
    await waitFor(() => expect(store.getState().editor.fileName).toBe('dropped.html'));
    expect(store.getState().editor.html).toBe(PAGE);
  });

  it('ignores text dragged inside the editor', () => {
    renderWorkbench();
    const pane = document.getElementById('pane-source');
    fireEvent.dragEnter(pane, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(screen.queryByText('Drop an .html or .css file to open it')).toBeNull();
  });

  it('hides the drop target when the drag leaves the pane', () => {
    renderWorkbench();
    const pane = document.getElementById('pane-source');
    const dataTransfer = { types: ['Files'], files: [] };
    fireEvent.dragEnter(pane, { dataTransfer });
    fireEvent.dragEnter(screen.getByLabelText('HTML source'), { dataTransfer });
    fireEvent.dragLeave(screen.getByLabelText('HTML source'), { dataTransfer });
    expect(screen.getByText('Drop an .html or .css file to open it')).toBeTruthy();
    fireEvent.dragLeave(pane, { dataTransfer });
    expect(screen.queryByText('Drop an .html or .css file to open it')).toBeNull();
  });
});
