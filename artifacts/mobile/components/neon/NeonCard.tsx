import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

/**
 * The glass card every block floats in: a translucent navy fill that lets the aurora show through, a blue-violet
 * outline, and a big radius. In light it is a white card with a hairline.
 */
export function NeonCard({ children, style, radius = 22 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; radius?: number }) {
  const { neon } = useTheme();
  return (
    <View style={[styles.base, { backgroundColor: neon.glass, borderColor: neon.cardBorder, borderRadius: radius }, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1.5, overflow: 'hidden' },
});
