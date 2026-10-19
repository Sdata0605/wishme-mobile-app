import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '@/context/ThemeContext';

const SIZE = 152;
const CENTER = SIZE / 2;
/** One master loop; every moving part divides into it evenly, so the loop never shows a seam. */
const LOOP_MS = 2400;

// The heart: four cubic curves, about 68 wide and 66 tall, centred a little above the middle of the canvas.
const HEART_SEGMENTS: [number, number, number, number, number, number, number, number][] = [
  [76, 108, 52, 90, 42, 76, 42, 62],
  [42, 62, 42, 50, 51, 42, 61, 42],
  [61, 42, 68, 42, 73.5, 46, 76, 52],
  [76, 52, 78.5, 46, 84, 42, 91, 42],
  [91, 42, 101, 42, 110, 50, 110, 62],
  [110, 62, 110, 76, 100, 90, 76, 108],
];
const HEART_PATH = 'M76 108 C52 90 42 76 42 62 C42 50 51 42 61 42 C68 42 73.5 46 76 52 C78.5 46 84 42 91 42 C101 42 110 50 110 62 C110 76 100 90 76 108 Z';

/** The length of the outline, measured by sampling the curves (the dash animation needs it). */
function pathLength(): number {
  let total = 0;
  for (const [x0, y0, x1, y1, x2, y2, x3, y3] of HEART_SEGMENTS) {
    let px = x0;
    let py = y0;
    for (let i = 1; i <= 40; i++) {
      const t = i / 40;
      const u = 1 - t;
      const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
      const y = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
      total += Math.hypot(x - px, y - py);
      px = x;
      py = y;
    }
  }
  return total;
}

/** An arc of the circle of radius r, from one angle to another (degrees, clockwise from the top). */
function arcPath(r: number, fromDeg: number, spanDeg: number): string {
  const at = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [CENTER + r * Math.cos(a), CENTER + r * Math.sin(a)];
  };
  const [x0, y0] = at(fromDeg);
  const [x1, y1] = at(fromDeg + spanDeg);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${spanDeg > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** A small four-pointed star centred on (0, 0). */
const STAR = 'M0 -4 L1.1 -1.1 L4 0 L1.1 1.1 L0 4 L-1.1 1.1 L-4 0 L-1.1 -1.1 Z';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * "Wish trace": a comet of light draws a heart over and over, inside two slow aurora arcs and a ring of twinkling sparks, like a
 * wish being written. When `done` turns true the heart closes into a solid stroke, fills and pops, and the arcs and sparks
 * gather in. With reduce motion on nothing moves: the heart is drawn complete and the arcs and sparks stand still.
 */
export function WishTrace({ done, reduceMotion }: { done: boolean; reduceMotion: boolean }) {
  const { neon } = useTheme();
  const LEN = useMemo(pathLength, []);
  const DASH = 38;

  const t = useSharedValue(0); // the comet, 0..1 around the heart
  const arcA = useSharedValue(0);
  const arcB = useSharedValue(0);
  const ring = useSharedValue(0);
  const breathe = useSharedValue(0);
  const twinkle0 = useSharedValue(0.3);
  const twinkle1 = useSharedValue(0.3);
  const twinkle2 = useSharedValue(0.3);
  const finish = useSharedValue(0); // 0 while loading, 1 when done (everything gathers in)
  const fill = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    const linear = Easing.linear;
    t.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: linear }), -1, false);
    arcA.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: linear }), -1, false);
    arcB.value = withRepeat(withTiming(1, { duration: LOOP_MS * 2, easing: linear }), -1, false);
    ring.value = withRepeat(withTiming(1, { duration: LOOP_MS * 3, easing: linear }), -1, false);
    breathe.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }), -1, true);
    const blink = () => withRepeat(withSequence(withTiming(1, { duration: 400, easing: Easing.inOut(Easing.quad) }), withTiming(0.3, { duration: 400, easing: Easing.inOut(Easing.quad) })), -1, false);
    twinkle0.value = blink();
    twinkle1.value = withDelay(267, blink());
    twinkle2.value = withDelay(533, blink());
    return () => {
      [t, arcA, arcB, ring, breathe, twinkle0, twinkle1, twinkle2].forEach((v) => cancelAnimation(v));
    };
  }, [reduceMotion, t, arcA, arcB, ring, breathe, twinkle0, twinkle1, twinkle2, LEN]);

  // Done: the heart closes, fills and pops, and the rest gathers in.
  useEffect(() => {
    if (!done) return;
    if (reduceMotion) {
      fill.value = withTiming(1, { duration: 200 });
      return;
    }
    finish.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) });
    fill.value = withDelay(250, withTiming(1, { duration: 350 }));
    pop.value = withDelay(250, withSequence(withTiming(1.15, { duration: 160 }), withSpring(1, { damping: 12, stiffness: 180 })));
  }, [done, reduceMotion, finish, fill, pop]);

  // Only the offset moves (the dash pattern itself is fixed): one short bright segment travels the outline.
  const cometProps = useAnimatedProps(() => ({ strokeDashoffset: -LEN * t.value }));
  // Closing, or reduced motion: the whole outline fades in over the travelling segment.
  const closedProps = useAnimatedProps(() => ({ strokeOpacity: reduceMotion ? 1 : finish.value }));
  const fillProps = useAnimatedProps(() => ({ fillOpacity: fill.value * 0.85 }));

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: (1 + breathe.value * 0.04) * pop.value }],
  }));
  const arcAStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.8 : 1 - finish.value,
    transform: [{ rotate: `${reduceMotion ? 30 : arcA.value * 360 * (1 - finish.value * 0.5)}deg` }],
  }));
  const arcBStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.8 : 1 - finish.value,
    transform: [{ rotate: `${reduceMotion ? 210 : -arcB.value * 360 * (1 - finish.value * 0.5)}deg` }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 1 : 1 - finish.value,
    transform: [{ rotate: `${reduceMotion ? 0 : ring.value * 360}deg` }, { scale: 1 - finish.value * 0.4 }],
  }));
  const spark = (v: { value: number }) => useAnimatedStyle(() => ({ opacity: reduceMotion ? 0.6 : v.value })); // eslint-disable-line react-hooks/rules-of-hooks
  const spark0 = spark(twinkle0);
  const spark1 = spark(twinkle1);
  const spark2 = spark(twinkle2);

  const sparkAt = (deg: number, tint: string, style: object) => {
    const a = ((deg - 90) * Math.PI) / 180;
    const x = CENTER + 72 * Math.cos(a);
    const y = CENTER + 72 * Math.sin(a);
    return (
      <Animated.View key={deg} style={[StyleSheet.absoluteFill, style]}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Path d={STAR} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} fill="#FFFFFF" stroke={tint} strokeWidth={1.2} />
        </Svg>
      </Animated.View>
    );
  };

  return (
    <View style={styles.canvas} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, arcAStyle]}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Defs>
            <LinearGradient id="wtArcA" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={neon.violet} />
              <Stop offset="1" stopColor={neon.blue} />
            </LinearGradient>
          </Defs>
          <Path d={arcPath(66, 0, 110)} stroke="url(#wtArcA)" strokeWidth={2} strokeLinecap="round" fill="none" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, arcBStyle]}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Defs>
            <LinearGradient id="wtArcB" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={neon.cyan} />
              <Stop offset="1" stopColor={neon.violet} />
            </LinearGradient>
          </Defs>
          <Path d={arcPath(66, 180, 70)} stroke="url(#wtArcB)" strokeWidth={2} strokeLinecap="round" fill="none" />
        </Svg>
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
        {sparkAt(0, neon.cyan, spark0)}
        {sparkAt(120, neon.pink, spark1)}
        {sparkAt(240, neon.cyan, spark2)}
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, heartStyle]}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Defs>
            <LinearGradient id="wtComet" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={neon.pink} />
              <Stop offset="0.5" stopColor={neon.violet} />
              <Stop offset="1" stopColor={neon.cyan} />
            </LinearGradient>
            <LinearGradient id="wtFill" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={neon.violet} />
              <Stop offset="1" stopColor={neon.pink} />
            </LinearGradient>
          </Defs>
          <AnimatedPath d={HEART_PATH} fill="url(#wtFill)" fillOpacity={0} animatedProps={fillProps} />
          <Path d={HEART_PATH} stroke="#FFFFFF" strokeOpacity={0.1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <AnimatedPath d={HEART_PATH} stroke="url(#wtComet)" strokeOpacity={0.25} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={[DASH, LEN - DASH]} animatedProps={cometProps} />
          <AnimatedPath d={HEART_PATH} stroke="url(#wtComet)" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={[DASH, LEN - DASH]} animatedProps={cometProps} />
          <AnimatedPath d={HEART_PATH} stroke="url(#wtComet)" strokeOpacity={0} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" animatedProps={closedProps} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
});
