import React from 'react';
import { StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

/** The frosted layer of a glass sheet (~ backdrop-filter: blur(12px)). Render as the first child of a translucent, overflow-hidden sheet. */
export function GlassBlur() {
  return (
    <BlurView
      intensity={40}
      tint="dark"
      experimentalBlurMethod="dimezisBlurView"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
