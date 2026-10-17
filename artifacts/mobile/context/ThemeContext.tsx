import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { makeColors, makeGradients } from '@/constants/colors';
import { BRAND_ACCENT, buildNeon, type Neon } from '@/constants/neon';

type Colors = ReturnType<typeof makeColors>;

interface ThemeContextValue {
  isDark: boolean;
  colors: Colors;
  gradients: ReturnType<typeof makeGradients>;
  /** WishMe's design tokens (primary, highlight, pink, surfaces, accents A to F...). */
  neon: Neon;
  /** The brand colour the palette is built around (fixed; kept for code that keys caches on it). */
  accent: string;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === 'dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('theme')
      .then((theme) => {
        if (theme !== null) setIsDark(theme === 'dark');
      })
      .finally(() => setLoaded(true));
  }, []);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  const neon = useMemo(() => buildNeon(isDark), [isDark]);
  const colors = useMemo(() => makeColors(neon), [neon]);
  const gradients = useMemo(() => makeGradients(neon), [neon]);
  const value = useMemo(
    () => ({ isDark, colors, gradients, neon, accent: BRAND_ACCENT, toggle }),
    [isDark, colors, gradients, neon, toggle],
  );

  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
