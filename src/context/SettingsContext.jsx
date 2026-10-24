// context/SettingsContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { readPref, writePref } from '../services/storage';

const SettingsContext = createContext(null);

const systemPrefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function SettingsProvider({ children }) {
  const [theme, setTheme] = useState(() => readPref('theme') ?? 'system');
  const [reducedMotion, setReducedMotion] = useState(
    () => readPref('reducedMotion') ?? systemPrefersReducedMotion(),
  );

  // Reflect settings on <html> so plain CSS can react to them.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.motion = reducedMotion ? 'reduce' : 'full';
    writePref('theme', theme);
    writePref('reducedMotion', reducedMotion);
  }, [theme, reducedMotion]);

  const value = useMemo(
    () => ({ theme, setTheme, reducedMotion, setReducedMotion }),
    [theme, reducedMotion],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
