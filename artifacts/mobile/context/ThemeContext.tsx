import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, gradients, lightColors } from '@/constants/colors';

type Colors = typeof lightColors;

interface ThemeContextValue {
  isDark: boolean;
  colors: Colors;
  gradients: typeof gradients;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === 'dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('theme').then((val) => {
      if (val !== null) {
        setIsDark(val === 'dark');
      }
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

  if (!loaded) return null;

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, colors, gradients, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
