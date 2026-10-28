
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import KeyboardShortcuts from '../../src/features/shortcuts/KeyboardShortcuts';

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };

  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

afterEach(() => {
  cleanup();
});

function renderShortcuts(initialPath = '/') {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <>
            <KeyboardShortcuts />
            <main>Test page: {initialPath}</main>
            <input aria-label="Test input" />
            <div contentEditable role="textbox" aria-label="Code editor">
              Editable content
            </div>
          </>
        ),
      },
    ],
    { initialEntries: [initialPath] },
  );

  return { router, ...render(<RouterProvider router={router} />) };
}

describe('KeyboardShortcuts', () => {
  it('opens help when ? is pressed outside editable fields', () => {
    renderShortcuts();

    fireEvent.keyDown(window, { key: '?', shiftKey: true });

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Keyboard shortcuts')).toBeTruthy();
  });

  it('closes help when Escape is pressed', () => {
  renderShortcuts();

  fireEvent.keyDown(window, { key: '?', shiftKey: true });
  expect(document.querySelector('dialog').open).toBe(true);

  fireEvent.keyDown(window, { key: 'Escape' });

  expect(document.querySelector('dialog').open).toBe(false);
});
  it('does not open help while typing in an input', () => {
  renderShortcuts();

  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Test input' }), {
    key: '?',
    shiftKey: true,
  });

  expect(document.querySelector('dialog').open).toBe(false);
});

  it('navigates to Learn with Alt+Shift+L', async () => {
    const { router } = renderShortcuts('/');

    fireEvent.keyDown(window, {
      key: 'l',
      altKey: true,
      shiftKey: true,
    });

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/learn'));
  });

  it('does not navigate when a shortcut is pressed in an input', async () => {
    const { router } = renderShortcuts('/');

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Test input' }), {
      key: 'l',
      altKey: true,
      shiftKey: true,
    });

    expect(router.state.location.pathname).toBe('/');
  });
});
