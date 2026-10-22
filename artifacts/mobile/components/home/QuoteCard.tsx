import { LinearGradient } from 'expo-linear-gradient';
import React, { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * One look for the day's thought as a shareable picture (4:5, the size Instagram and WhatsApp show best). Each design
 * is a background, a type colour and a small accent; the quote, the date and the WishMe mark are the same on all of
 * them. Sizes are given for a 360-wide card and scaled, so the capture looks the same on every phone.
 */
export interface QuoteDesign {
  id: string;
  name: string;
  /** Two or three stops, top-left to bottom-right; one colour for a flat card. */
  colors: readonly [string, string, ...string[]] | readonly [string];
  text: string;
  dim: string;
  accent: string;
  /** The sans face instead of the serif one. */
  sans?: boolean;
  /** A soft glowing disc, where it sits and its colour. */
  glow?: { x: number; y: number; size: number; color: string; opacity: number };
  /** A thin inner frame in the accent colour. */
  frame?: boolean;
}

export const QUOTE_DESIGNS: QuoteDesign[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    colors: ['#0B1026', '#1B1F5A', '#3A1D6E'],
    text: '#FFFFFF',
    dim: 'rgba(255,255,255,0.62)',
    accent: '#E555FF',
    glow: { x: 230, y: -60, size: 260, color: '#1F7BFF', opacity: 0.35 },
  },
  {
    id: 'sunrise',
    name: 'Sunrise',
    colors: ['#FF7A18', '#FF3D81', '#B43BFF'],
    text: '#FFFFFF',
    dim: 'rgba(255,255,255,0.75)',
    accent: '#FFF1C9',
    glow: { x: -80, y: 300, size: 300, color: '#FFD166', opacity: 0.3 },
  },
  {
    id: 'paper',
    name: 'Paper',
    colors: ['#F6F1E7'],
    text: '#1A1A2E',
    dim: 'rgba(26,26,46,0.55)',
    accent: '#D4A72C',
  },
  {
    id: 'neon',
    name: 'Neon',
    colors: ['#07070F', '#0E0A1F'],
    text: '#FFFFFF',
    dim: 'rgba(255,255,255,0.55)',
    accent: '#19E3FF',
    frame: true,
    glow: { x: -70, y: 320, size: 280, color: '#7B5CFA', opacity: 0.45 },
  },
  {
    id: 'royal',
    name: 'Royal',
    colors: ['#2A0A3D', '#5B1E6E', '#1A0B2E'],
    text: '#F2D27A',
    dim: 'rgba(242,210,122,0.6)',
    accent: '#F2D27A',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: ['#0B3C5D', '#1E88A8', '#13C2C2'],
    text: '#FFFFFF',
    dim: 'rgba(255,255,255,0.7)',
    accent: '#FFFFFF',
    sans: true,
    glow: { x: 200, y: 260, size: 320, color: '#FFFFFF', opacity: 0.12 },
  },
];

interface Props {
  quote: string;
  date: string;
  design: QuoteDesign;
  /** The card's width on screen; the height follows (4:5). */
  width: number;
}

/** The card is a plain View so react-native-view-shot can capture it; the ref points at that View. */
export const QuoteCard = forwardRef<View, Props>(function QuoteCard({ quote, date, design, width }, ref) {
  const k = width / 360;
  const height = width * 1.25;
  const long = quote.length > 56;
  const fontSize = (design.sans ? (long ? 24 : 27) : long ? 25 : 28) * k;
  const family = design.sans ? 'Inter_700Bold' : 'PlayfairDisplay_700Bold';
  const flat = design.colors.length === 1;

  return (
    <View ref={ref} collapsable={false} style={[styles.card, { width, height, borderRadius: 22 * k }]}>
      {flat ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: design.colors[0] }]} />
      ) : (
        <LinearGradient
          colors={design.colors as unknown as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {design.glow ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: design.glow.x * k,
            top: design.glow.y * k,
            width: design.glow.size * k,
            height: design.glow.size * k,
            borderRadius: (design.glow.size * k) / 2,
            backgroundColor: design.glow.color,
            opacity: design.glow.opacity,
          }}
        />
      ) : null}
      {design.frame ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 14 * k,
            top: 14 * k,
            right: 14 * k,
            bottom: 14 * k,
            borderRadius: 14 * k,
            borderWidth: 1.5 * k,
            borderColor: design.accent,
            opacity: 0.8,
          }}
        />
      ) : null}

      <View style={{ flex: 1, padding: 34 * k, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 * k }}>
          <View style={{ width: 22 * k, height: 2 * k, borderRadius: 1, backgroundColor: design.accent }} />
          <Text style={{ color: design.dim, fontSize: 11.5 * k, fontFamily: 'Inter_500Medium', letterSpacing: 1.2 * k }}>
            {date.toUpperCase()}
          </Text>
        </View>

        <View>
          <Text style={{ color: design.accent, fontSize: 64 * k, lineHeight: 56 * k, fontFamily: 'PlayfairDisplay_700Bold', opacity: 0.55 }}>
            {'“'}
          </Text>
          <Text style={{ color: design.text, fontSize, lineHeight: fontSize * 1.28, fontFamily: family, letterSpacing: -0.3 * k }}>
            {quote}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 * k }}>
            <View style={{ width: 9 * k, height: 9 * k, borderRadius: 5 * k, backgroundColor: design.accent }} />
            <Text style={{ color: design.text, fontSize: 14 * k, fontFamily: 'Inter_700Bold', letterSpacing: 0.4 * k }}>WishMe</Text>
          </View>
          <Text style={{ color: design.dim, fontSize: 11 * k, fontFamily: 'Inter_500Medium' }}>Today's thought</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
});
