import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import Simulator from '../../src/features/simulate/Simulator';
import { makeStore } from '../helpers/store';

afterEach(cleanup);
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

const setup = () =>
  render(
    <Provider store={makeStore()}>
      <MemoryRouter>
        <Simulator />
      </MemoryRouter>
    </Provider>,
  );

describe('Simulate views', () => {
  it('are tabs, like the Workbench editor, moved between with the arrow keys', () => {
    setup();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual([
      'Visual preview',
      'Keyboard tab order',
      'Screen-reader view',
    ]);
    const [preview, order, reader] = tabs;
    expect(screen.getByRole('tablist', { name: 'Simulation view' })).toBeTruthy();
    expect(preview.getAttribute('aria-selected')).toBe('true');
    expect(preview.tabIndex).toBe(0);
    expect(order.tabIndex).toBe(-1);
    expect(screen.getByRole('tabpanel', { name: 'Visual preview' })).toBeTruthy();

    fireEvent.keyDown(preview, { key: 'ArrowRight' });
    expect(order.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(order);
    expect(screen.getByRole('tabpanel', { name: 'Keyboard tab order' })).toBeTruthy();

    fireEvent.keyDown(order, { key: 'End' });
    expect(document.activeElement).toBe(reader);
    expect(screen.getByRole('tabpanel', { name: 'Screen-reader view' })).toBeTruthy();

    fireEvent.keyDown(reader, { key: 'ArrowRight' }); // wraps round to the first
    expect(document.activeElement).toBe(preview);
    expect(preview.getAttribute('aria-selected')).toBe('true');
  });

  it('gives every tab a panel to control, showing only the chosen one', () => {
    const { container } = setup();
    for (const tab of screen.getAllByRole('tab')) {
      const panel = container.querySelector(`#${tab.getAttribute('aria-controls')}`);
      expect(panel.getAttribute('role')).toBe('tabpanel');
      expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
      expect(panel.hidden).toBe(tab.getAttribute('aria-selected') !== 'true');
    }
  });
});
