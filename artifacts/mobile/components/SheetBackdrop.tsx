import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

/**
 * Blurred, tap-blocking scrim for bottom sheets. Render as the first child of the sheet's backdrop;
 * the parent <Modal animationType="fade"> animates it in and out.
 */
export function SheetBackdrop({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={onPress} accessibilityLabel="Close">
      <BlurView
        intensity={16}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,0,20,0.25)' }]}
      />
    </Pressable>
  );
}
