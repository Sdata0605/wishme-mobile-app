import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

/** A pulsing placeholder block. */
export function Shimmer({ style }: { style?: StyleProp<ViewStyle> }) {
  const { neon } = useTheme();
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.9, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.45, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ backgroundColor: neon.glass, opacity: v }, style]} />;
}

/**
 * A story's picture. While it loads (or when the story has none, or the address is broken) the area shows the theme's
 * gradient instead, so a card never looks empty. `loading` shows the shimmer.
 */
export function StoryImage({ uri, loading, style }: { uri: string | null | undefined; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  const { neon } = useTheme();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const show = !!uri && !failed;
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: neon.glass }, style]}>
      <LinearGradient colors={neon.gVioletCyan as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { opacity: 0.55 }]} />
      {show ? (
        <Image source={{ uri: uri as string }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} onError={() => setFailed(true)} />
      ) : loading ? (
        <Shimmer style={StyleSheet.absoluteFill} />
      ) : null}
    </View>
  );
}
