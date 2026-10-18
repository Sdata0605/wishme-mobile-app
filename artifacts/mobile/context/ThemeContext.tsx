import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { makeColors, makeGradients } from '@/constants/colors';
import { buildNeon, DEFAULT_ACCENT, DEFAULT_DARK_THEME, THEMES, type Neon, type ThemeId } from '@/constants/neon';

type Colors = ReturnType<typeof makeColors>;

interface ThemeContextValue {
  /** The chosen theme: Light, or one of the dark WishMe themes. */
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
  isDark: boolean;
  colors: Colors;
  gradients: ReturnType<typeof makeGradients>;
  /** The full token set (violet, cyan, pink, surfaces, accents A to F...). */
  neon: Neon;
  /** The user's chosen accent colour (the seed the whole palette derives from). */
  accent: string;
  setAccent: (hex: string) => void;
  /** Light ⇄ dark: switches to Light, or back to the dark theme last used. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const ACCENT_KEY = 'accent_seed_v1';
const THEME_KEY = 'theme';
const LAST_DARK_KEY = 'theme_last_dark';

/** A stored theme value, including the 'dark' that builds before themes existed saved. */
function parseTheme(v: string | null): ThemeId | null {
  if (v === 'dark') return DEFAULT_DARK_THEME;
  return THEMES.some((t) => t.id === v) ? (v as ThemeId) : null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Until the user picks one, everyone gets the default theme (Aurora), whatever the system setting.
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_DARK_THEME);
  const [lastDark, setLastDark] = useState<Exclude<ThemeId, 'light'>>(DEFAULT_DARK_THEME);
  const [accent, setAccentState] = useState(DEFAULT_ACCENT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(THEME_KEY),
      AsyncStorage.getItem(LAST_DARK_KEY),
      AsyncStorage.getItem(ACCENT_KEY),
    ]).then(([saved, savedDark, seed]) => {
      const t = parseTheme(saved);
      const d = parseTheme(savedDark);
      if (t) setThemeState(t);
      if (t && t !== 'light') setLastDark(t);
      else if (d && d !== 'light') setLastDark(d);
      if (seed && /^#[0-9A-Fa-f]{6}$/.test(seed)) setAccentState(seed);
      setLoaded(true);
    });
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    AsyncStorage.setItem(THEME_KEY, id).catch(() => {});
    if (id !== 'light') {
      setLastDark(id);
      AsyncStorage.setItem(LAST_DARK_KEY, id).catch(() => {});
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === 'light' ? lastDark : 'light');
  }, [theme, lastDark, setTheme]);

  const isDark = theme !== 'light';

  const setAccent = useCallback((hex: string) => {
    setAccentState(hex);
    AsyncStorage.setItem(ACCENT_KEY, hex).catch(() => {});
  }, []);

  const neon = useMemo(() => buildNeon(theme, accent), [theme, accent]);
  const colors = useMemo(() => makeColors(neon), [neon]);
  const gradients = useMemo(() => makeGradients(neon), [neon]);
  const value = useMemo(
    () => ({ theme, setTheme, isDark, colors, gradients, neon, accent, setAccent, toggle }),
    [theme, setTheme, isDark, colors, gradients, neon, accent, setAccent, toggle],
  );

  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
