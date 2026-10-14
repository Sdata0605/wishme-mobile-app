import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

/**
 * The fill of a primary button. In dark it is the app's blue-to-magenta brand gradient; in light it renders nothing,
 * so the button keeps the solid colour from its own style. Put it as the first child of a button that has
 * `overflow: 'hidden'` and its rounded corners, then the label on top.
 */
export function BrandFill() {
  const { neon, isDark } = useTheme();
  if (!isDark) return null;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={neon.gBrand as unknown as [string, string]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={StyleSheet.absoluteFill}
    />
  );
}

/** A dark scrim along the bottom of a photo banner so its caption stays readable. Nothing in light. */
export function BannerScrim() {
  const { isDark } = useTheme();
  if (!isDark) return null;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['transparent', 'rgba(7,16,72,0.82)']}
      start={{ x: 0, y: 0.35 }}
      end={{ x: 0, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
