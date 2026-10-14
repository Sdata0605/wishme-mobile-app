import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { makeColors, makeGradients } from '@/constants/colors';
import { buildNeon, DEFAULT_ACCENT, type Neon } from '@/constants/neon';

type Colors = ReturnType<typeof makeColors>;

interface ThemeContextValue {
  isDark: boolean;
  colors: Colors;
  gradients: ReturnType<typeof makeGradients>;
  /** The full MyAssistant token set (violet, cyan, pink, surfaces, accents A to F...). */
  neon: Neon;
  /** The user's chosen accent colour (the seed the whole palette derives from). */
  accent: string;
  setAccent: (hex: string) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const ACCENT_KEY = 'accent_seed_v1';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === 'dark');
  const [accent, setAccentState] = useState(DEFAULT_ACCENT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem('theme'), AsyncStorage.getItem(ACCENT_KEY)]).then(([theme, seed]) => {
      if (theme !== null) setIsDark(theme === 'dark');
      if (seed && /^#[0-9A-Fa-f]{6}$/.test(seed)) setAccentState(seed);
      setLoaded(true);
    });
  }, []);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  const setAccent = useCallback((hex: string) => {
    setAccentState(hex);
    AsyncStorage.setItem(ACCENT_KEY, hex).catch(() => {});
  }, []);

  const neon = useMemo(() => buildNeon(isDark, accent), [isDark, accent]);
  const colors = useMemo(() => makeColors(neon), [neon]);
  const gradients = useMemo(() => makeGradients(neon), [neon]);
  const value = useMemo(
    () => ({ isDark, colors, gradients, neon, accent, setAccent, toggle }),
    [isDark, colors, gradients, neon, accent, setAccent, toggle],
  );

  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
