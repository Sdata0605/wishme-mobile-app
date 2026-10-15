import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthMark } from '@/components/auth/AuthUI';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { GradientText } from '@/components/neon/GradientText';
import { Reveal } from '@/components/neon/Motion';
import { useTheme } from '@/context/ThemeContext';

/** One of the three loading dots: fades up and down in a loop, `delay` ms behind the one before it. */
function PulseDot({ delay }: { delay: number }) {
  const { neon } = useTheme();
  const v = useRef(new Animated.Value(0.25)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.25, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(300 - delay),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return <Animated.View style={[styles.dot, { backgroundColor: neon.cyan, opacity: v }]} />;
}

/** The branded loading screen: the WishMe mark (its ring breathes), the wordmark, a tagline and three pulsing dots. */
export function SplashView() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.05, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <View style={styles.center}>
        <Reveal>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <AuthMark size={112} />
          </Animated.View>
        </Reveal>
        <Reveal delayMs={100} style={styles.wordmark}>
          <GradientText colors={[neon.cyan, neon.pink]} fontSize={36} fontFamily="PlayfairDisplay_700Bold" letterSpacing={-0.5}>
            WishMe
          </GradientText>
        </Reveal>
        <Reveal delayMs={180}>
          <Text style={[styles.tagline, { color: neon.textLo }]}>Wishes, bills, travel. One app.</Text>
        </Reveal>
      </View>
      <View style={[styles.dots, { bottom: insets.bottom + 48 }]}>
        <PulseDot delay={0} />
        <PulseDot delay={150} />
        <PulseDot delay={300} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordmark: { alignItems: 'center', marginTop: 20 },
  tagline: { fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 8, textAlign: 'center' },
  dots: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
