/**
 * A celebrity's photo, or, when there is none yet, their initials on the WishMe brand gradient. Celebrities without a
 * genuine photo get no photo at all rather than a stand-in picture of someone else.
 */
import { Image, type ImageContentFit } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { BRAND } from '@/constants/neon';

export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '★';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]![0] ?? '' : '';
  return (first + last).toUpperCase();
}

interface Props {
  uri?: string | null;
  name?: string | null;
  style?: StyleProp<ViewStyle | ImageStyle>;
  contentFit?: ImageContentFit;
  blurRadius?: number;
  /** Stable key for list recycling (the celebrity id). */
  recyclingKey?: string;
}

export function CelebrityPhoto({ uri, name, style, contentFit = 'cover', blurRadius, recyclingKey }: Props) {
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState(0);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={style as never}
        contentFit={contentFit}
        cachePolicy="memory-disk"
        transition={200}
        blurRadius={blurRadius}
        recyclingKey={recyclingKey}
        onError={() => setFailed(true)}
        accessibilityLabel={name ? `Photo of ${name}` : undefined}
      />
    );
  }
  return (
    <View
      style={[styles.fallback, style as StyleProp<ViewStyle>]}
      onLayout={(e) => setSize(Math.min(e.nativeEvent.layout.width, e.nativeEvent.layout.height))}
      accessibilityLabel={name ? `${name}, no photo yet` : undefined}
    >
      <LinearGradient colors={[BRAND.orange, BRAND.pink, BRAND.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {size > 0 ? (
        <Text style={[styles.initials, { fontSize: Math.max(12, Math.round(size * 0.34)) }]} numberOfLines={1} adjustsFontSizeToFit>
          {initialsOf(name)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontFamily: 'PlayfairDisplay_700Bold', letterSpacing: 1 },
});
