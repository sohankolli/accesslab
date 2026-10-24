import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SettingsProvider, useSettings } from '../../src/context/SettingsContext';
import PackSettings from '../../src/features/audit/PackSettings';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

function EnabledPacks() {
  return <output>{useSettings().enabledPacks.join(',')}</output>;
}

const renderSettings = () =>
  render(
    <SettingsProvider>
      <PackSettings />
      <EnabledPacks />
    </SettingsProvider>,
  );

describe('PackSettings', () => {
  it('starts with every pack on', () => {
    renderSettings();
    expect(screen.getByRole('checkbox', { name: 'WCAG 2.2 A/AA' }).checked).toBe(true);
    expect(screen.getByRole('checkbox', { name: 'Best practice' }).checked).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('wcag-aa,best-practice');
  });

  it('switches a pack off and remembers it across reloads', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Best practice' }));
    expect(screen.getByRole('status').textContent).toBe('wcag-aa');
    expect(JSON.parse(localStorage.getItem('accesslab:v1')).prefs.disabledPacks).toEqual([
      'best-practice',
    ]);

    cleanup(); // "reload": a fresh provider reads the saved preference
    renderSettings();
    expect(screen.getByRole('checkbox', { name: 'Best practice' }).checked).toBe(false);
  });

  it('ignores saved ids of packs that no longer exist', () => {
    localStorage.setItem(
      'accesslab:v1',
      JSON.stringify({ prefs: { disabledPacks: ['retired-pack', 'wcag-aa'] } }),
    );
    renderSettings();
    expect(screen.getByRole('status').textContent).toBe('best-practice');
  });
});
