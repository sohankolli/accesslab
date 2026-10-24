// context/SettingsContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { readPref, writePref } from '../services/storage';
import { ALL_PACK_IDS } from '../engine/rules';

const SettingsContext = createContext(null);

const systemPrefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function SettingsProvider({ children }) {
  const [theme, setTheme] = useState(() => readPref('theme') ?? 'system');
  const [reducedMotion, setReducedMotion] = useState(
    () => readPref('reducedMotion') ?? systemPrefersReducedMotion(),
  );
  // Stored as the packs switched OFF, so a pack added in a later version is on by default.
  const [disabledPacks, setDisabledPacks] = useState(() => {
    const saved = readPref('disabledPacks');
    return Array.isArray(saved) ? saved.filter((id) => ALL_PACK_IDS.includes(id)) : [];
  });

  // Reflect settings on <html> so plain CSS can react to them.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.motion = reducedMotion ? 'reduce' : 'full';
    writePref('theme', theme);
    writePref('reducedMotion', reducedMotion);
  }, [theme, reducedMotion]);

  useEffect(() => {
    writePref('disabledPacks', disabledPacks);
  }, [disabledPacks]);

  const value = useMemo(() => {
    const enabledPacks = ALL_PACK_IDS.filter((id) => !disabledPacks.includes(id));
    const setPackEnabled = (id, on) =>
      setDisabledPacks((prev) => (on ? prev.filter((p) => p !== id) : [...new Set([...prev, id])]));
    return { theme, setTheme, reducedMotion, setReducedMotion, enabledPacks, setPackEnabled };
  }, [theme, reducedMotion, disabledPacks]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
