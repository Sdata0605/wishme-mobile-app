import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { PressScale } from '@/components/neon/Motion';
import { useTheme } from '@/context/ThemeContext';

/** The story screen's big gradient "Listen" pill. While the story is being read it shows moving bars and says "Stop". */
export function ListenButton({ speaking, onPress }: { speaking: boolean; onPress: () => void }) {
  const { neon } = useTheme();
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={speaking ? 'Stop listening' : 'Listen to this story'} style={styles.wrap}>
      <LinearGradient colors={neon.gVioletCyan as unknown as [string, string]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.pill}>
        {speaking ? <Bars /> : <Icon name="volume-2" size={20} color="#fff" />}
        <Text style={styles.label}>{speaking ? 'Stop' : 'Listen'}</Text>
      </LinearGradient>
    </PressScale>
  );
}

function Bars() {
  const bars = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 340 + i * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(b, { toValue: 0.3, duration: 340 + i * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [bars]);
  return (
    <View style={styles.bars}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={[styles.bar, { transform: [{ scaleY: b }] }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  pill: { height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  label: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 20 },
  bar: { width: 3.5, height: 20, borderRadius: 2, backgroundColor: '#fff' },
});
