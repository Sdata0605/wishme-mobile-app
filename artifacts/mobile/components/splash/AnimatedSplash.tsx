/**
 * The animated splash: what plays between the native splash image and the first screen.
 *
 * Layers, back to front:
 *  - the AmbientBackground every screen sits on,
 *  - three soft colour orbs drifting slowly, and a field of small sparks that twinkle and float up,
 *  - the WishMe heart in a disc, springing in, breathing, with a rotating gradient ring, a counter-rotating dashed
 *    ring and pulse rings that radiate out of it,
 *  - the wordmark, one letter at a time on a spring, coloured from cyan to pink across the word,
 *  - the tagline with an underline that draws itself, and a sweeping loader.
 *
 * It plays for at least `minDurationMs` so the choreography is never cut short, then, once `ready` is true, zooms
 * and fades out and calls `onDone` (exactly once) so the caller can navigate. Every loop runs on the UI thread
 * (Reanimated) and is cancelled on unmount. With the system "reduce motion" setting on, the loops are skipped and
 * the entrance is a plain fade.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, RadialGradient, Stop } from 'react-native-svg';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { mix, withAlpha, type Neon } from '@/constants/neon';
import { useTheme } from '@/context/ThemeContext';

const MARK = require('@/assets/images/wishme-mark.png');

/** The choreography, in ms from mount. */
const T = {
  mark: 80,
  ring: 320,
  pulse: 900,
  letters: 620,
  letterStep: 70,
  tagline: 1250,
  underline: 1450,
  loader: 400,
  exit: 420,
} as const;

const MARK_SIZE = 124;
const RING_PAD = 18;
const RING_SIZE = MARK_SIZE + RING_PAD * 2;
const OUTER_RING_SIZE = RING_SIZE + 26;

const WORD = 'WishMe';

/** A deterministic pseudo-random in [0, 1) so the spark field is the same on every launch. */
function rand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// ─── Background life ───────────────────────────────────────────────────────────────────────────────────────────

interface OrbSpec {
  color: string;
  size: number;
  /** Resting position as a fraction of the screen. */
  x: number;
  y: number;
  /** How far it drifts, in px. */
  dx: number;
  dy: number;
  duration: number;
  delay: number;
}

/** A soft radial pool of colour that drifts back and forth and breathes a little. */
function Orb({ spec, still }: { spec: OrbSpec; still: boolean }) {
  const { width: w, height: h } = useWindowDimensions();
  const t = useSharedValue(0);
  const id = useMemo(() => `orb${Math.round(rand(spec.size + spec.x * 100) * 1e6)}`, [spec]);

  useEffect(() => {
    if (still) return;
    t.value = withDelay(
      spec.delay,
      withRepeat(withTiming(1, { duration: spec.duration, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    return () => cancelAnimation(t);
  }, [t, spec, still]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: t.value * spec.dx },
      { translateY: t.value * spec.dy },
      { scale: 1 + t.value * 0.1 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        { width: spec.size, height: spec.size, left: w * spec.x - spec.size / 2, top: h * spec.y - spec.size / 2 },
        style,
      ]}
    >
      <Svg width={spec.size} height={spec.size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={spec.color} stopOpacity={0.5} />
            <Stop offset="0.45" stopColor={spec.color} stopOpacity={0.18} />
            <Stop offset="1" stopColor={spec.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={spec.size / 2} cy={spec.size / 2} r={spec.size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** One small point of light: fades in and out and floats upward, on its own rhythm. */
function Spark({ seed, color, still }: { seed: number; color: string; still: boolean }) {
  const { width: w, height: h } = useWindowDimensions();
  const r1 = rand(seed);
  const r2 = rand(seed + 1);
  const r3 = rand(seed + 2);
  const r4 = rand(seed + 3);
  const size = 2 + Math.round(r3 * 3);
  const x = w * (0.06 + r1 * 0.88);
  const y = h * (0.1 + r2 * 0.8);
  const drift = 18 + r4 * 26;
  const period = 1800 + r3 * 1800;

  const glow = useSharedValue(still ? 0.5 : 0);
  const rise = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    glow.value = withDelay(
      r4 * 1400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: period * 0.4, easing: Easing.out(Easing.quad) }),
          withTiming(0.08, { duration: period * 0.6, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
    rise.value = withDelay(r4 * 1400, withRepeat(withTiming(1, { duration: period, easing: Easing.linear }), -1, false));
    return () => {
      cancelAnimation(glow);
      cancelAnimation(rise);
    };
  }, [glow, rise, still, r4, period]);

  const style = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ translateY: -rise.value * drift }, { scale: 0.6 + glow.value * 0.8 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.spark,
        { left: x, top: y, width: size, height: size, borderRadius: size / 2, backgroundColor: color, shadowColor: color },
        style,
      ]}
    />
  );
}

// ─── The mark ──────────────────────────────────────────────────────────────────────────────────────────────────

/** A ring that expands out of the mark and fades, over and over, `delay` ms behind the first one. */
function PulseRing({ delay, color, still }: { delay: number; color: string; still: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    p.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 1700, easing: Easing.out(Easing.cubic) })),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(p);
  }, [p, delay, still]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.1, 1], [0, 0.55, 0]),
    transform: [{ scale: 1 + p.value * 1.15 }],
  }));

  return <Animated.View pointerEvents="none" style={[styles.pulse, { borderColor: color }, style]} />;
}

/** The heart in its disc, inside a rotating gradient arc and a slower, counter-rotating dashed ring. */
function Mark({ neon, still, enter }: { neon: Neon; still: boolean; enter: SharedValue<number> }) {
  const spin = useSharedValue(0);
  const breath = useSharedValue(0);

  useEffect(() => {
    if (still) return;
    spin.value = withRepeat(withTiming(1, { duration: 3600, easing: Easing.linear }), -1, false);
    breath.value = withDelay(
      T.pulse,
      withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    return () => {
      cancelAnimation(spin);
      cancelAnimation(breath);
    };
  }, [spin, breath, still]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.6, 1], [0, 0, 1]),
    transform: [{ rotate: `${spin.value * 360}deg` }, { scale: interpolate(enter.value, [0, 1], [0.7, 1]) }],
  }));
  const outerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.7, 1], [0, 0, 0.9]),
    transform: [{ rotate: `${-spin.value * 220}deg` }, { scale: interpolate(enter.value, [0, 1], [0.8, 1]) }],
  }));
  const discStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.4),
    transform: [{ scale: interpolate(enter.value, [0, 1], [0.45, 1]) * (1 + breath.value * 0.045) }],
  }));

  const circ = Math.PI * (RING_SIZE - 6);
  const outerCirc = Math.PI * (OUTER_RING_SIZE - 3);
  const [a, b] = neon.gBrand;

  return (
    <View style={styles.markBox}>
      <PulseRing delay={T.pulse} color={withAlpha(neon.cyan, 0.9)} still={still} />
      <PulseRing delay={T.pulse + 850} color={withAlpha(neon.pink, 0.8)} still={still} />

      <Animated.View pointerEvents="none" style={[styles.outerRing, outerStyle]}>
        <Svg width={OUTER_RING_SIZE} height={OUTER_RING_SIZE}>
          <Circle
            cx={OUTER_RING_SIZE / 2}
            cy={OUTER_RING_SIZE / 2}
            r={(OUTER_RING_SIZE - 3) / 2}
            stroke={withAlpha(neon.cyan, neon.isDark ? 0.55 : 0.35)}
            strokeWidth={1.5}
            fill="none"
            strokeDasharray={`${outerCirc / 48} ${outerCirc / 24}`}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Defs>
            <SvgLinearGradient id="splashArc" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={a} />
              <Stop offset="0.55" stopColor={neon.cyan} />
              <Stop offset="1" stopColor={b} />
            </SvgLinearGradient>
          </Defs>
          {/* a soft halo under the arc, then the arc itself: two thirds of the circle with a gap */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={(RING_SIZE - 6) / 2}
            stroke="url(#splashArc)"
            strokeWidth={10}
            strokeOpacity={0.18}
            fill="none"
            strokeDasharray={`${circ * 0.66} ${circ * 0.34}`}
            strokeLinecap="round"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={(RING_SIZE - 6) / 2}
            stroke="url(#splashArc)"
            strokeWidth={3.5}
            fill="none"
            strokeDasharray={`${circ * 0.66} ${circ * 0.34}`}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.disc, discStyle]}>
        <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.discEdge}>
          <View style={[styles.discInner, { backgroundColor: neon.surface }]}>
            <Image source={MARK} style={styles.markImage} resizeMode="contain" />
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

// ─── The words ─────────────────────────────────────────────────────────────────────────────────────────────────

/** One letter of the wordmark: springs up into place `index` steps after the first. */
function Letter({ ch, index, color, still }: { ch: string; index: number; color: string; still: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = still
      ? withDelay(T.letters, withTiming(1, { duration: 400 }))
      : withDelay(T.letters + index * T.letterStep, withSpring(1, { damping: 13, stiffness: 150, mass: 0.9 }));
    return () => cancelAnimation(p);
  }, [p, index, still]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, p.value * 1.3)),
    transform: [
      { translateY: (1 - p.value) * 28 },
      { scale: 0.7 + p.value * 0.3 },
      { rotate: `${(1 - p.value) * -8}deg` },
    ],
  }));

  return (
    <Animated.Text style={[styles.letter, { color, textShadowColor: withAlpha(color, 0.55) }, style]} maxFontSizeMultiplier={1.2}>
      {ch}
    </Animated.Text>
  );
}

/** The tagline fades up, then a thin gradient line draws itself under it. */
function Tagline({ neon, still }: { neon: Neon; still: boolean }) {
  const p = useSharedValue(0);
  const line = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(T.tagline, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    line.value = withDelay(still ? T.tagline : T.underline, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
    return () => {
      cancelAnimation(p);
      cancelAnimation(line);
    };
  }, [p, line, still]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 10 }],
  }));
  const lineStyle = useAnimatedStyle(() => ({
    opacity: line.value,
    transform: [{ scaleX: line.value }],
  }));

  return (
    <View style={styles.taglineBox}>
      <Animated.Text style={[styles.tagline, { color: neon.textLo }, textStyle]} maxFontSizeMultiplier={1.2}>
        Wishes, bills, travel. One app.
      </Animated.Text>
      <Animated.View style={[styles.underline, lineStyle]}>
        <LinearGradient colors={[withAlpha(neon.cyan, 0), neon.cyan, neon.pink, withAlpha(neon.pink, 0)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

/** A slim track with a gradient segment sweeping along it: "something is happening", without promising a percentage. */
function Loader({ neon, still, bottom }: { neon: Neon; still: boolean; bottom: number }) {
  const sweep = useSharedValue(0);
  const show = useSharedValue(0);
  useEffect(() => {
    show.value = withDelay(T.loader, withTiming(1, { duration: 400 }));
    if (!still) sweep.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.cubic) }), -1, false);
    return () => {
      cancelAnimation(sweep);
      cancelAnimation(show);
    };
  }, [sweep, show, still]);

  const trackStyle = useAnimatedStyle(() => ({ opacity: show.value }));
  const segStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(sweep.value, [0, 1], [-64, 132]) }],
  }));

  return (
    <Animated.View style={[styles.track, { bottom, backgroundColor: withAlpha(neon.textLo, neon.isDark ? 0.14 : 0.18) }, trackStyle]}>
      <Animated.View style={[styles.segment, segStyle]}>
        <LinearGradient colors={[withAlpha(neon.cyan, 0), neon.cyan, neon.pink, withAlpha(neon.pink, 0)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </Animated.View>
  );
}

// ─── The splash ────────────────────────────────────────────────────────────────────────────────────────────────

export interface AnimatedSplashProps {
  /** True once the app knows where to go. The splash finishes its choreography first, then leaves. */
  ready: boolean;
  /** Called once, after the exit animation, so the caller can navigate. */
  onDone: () => void;
  /** Shortest time the splash stays on screen, so the animation is never cut short. */
  minDurationMs?: number;
}

export function AnimatedSplash({ ready, onDone, minDurationMs = 2500 }: AnimatedSplashProps) {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const still = !!reduceMotion;

  const [minElapsed, setMinElapsed] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const leaving = useRef(false);

  const enter = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), still ? 900 : minDurationMs);
    return () => clearTimeout(timer);
  }, [minDurationMs, still]);

  useEffect(() => {
    enter.value = still
      ? withTiming(1, { duration: 400 })
      : withDelay(T.mark, withSpring(1, { damping: 12, stiffness: 120, mass: 1 }));
    return () => cancelAnimation(enter);
  }, [enter, still]);

  useEffect(() => {
    if (!ready || !minElapsed || leaving.current) return;
    leaving.current = true;
    const done = () => onDoneRef.current();
    exit.value = withTiming(1, { duration: still ? 220 : T.exit, easing: Easing.in(Easing.cubic) }, (finished) => {
      'worklet';
      if (finished) runOnJS(done)();
    });
  }, [ready, minElapsed, exit, still]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
  }));
  const stageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + exit.value * 0.12 }, { translateY: -exit.value * 24 }],
  }));

  const orbs = useMemo<OrbSpec[]>(
    () => [
      { color: neon.isDark ? neon.aurora?.blue ?? neon.violet : neon.violet, size: 420, x: 0.15, y: 0.18, dx: 36, dy: 28, duration: 7000, delay: 0 },
      { color: neon.pink, size: 380, x: 0.88, y: 0.72, dx: -30, dy: -40, duration: 8200, delay: 600 },
      { color: neon.cyan, size: 300, x: 0.8, y: 0.12, dx: -24, dy: 30, duration: 6400, delay: 1200 },
    ],
    [neon],
  );
  // White sparks read as stars on the dark aurora; on the light page they would be dark specks, so only accents there.
  const sparkColors = neon.isDark ? [neon.cyan, neon.pink, neon.violet, neon.textHi] : [neon.violet, neon.pink, neon.cyan];
  const letters = WORD.split('');

  return (
    <Animated.View style={[styles.root, rootStyle]}>
      <AmbientBackground />
      {orbs.map((o, i) => (
        <Orb key={i} spec={o} still={still} />
      ))}
      {Array.from({ length: still ? 0 : 18 }, (_, i) => (
        <Spark key={i} seed={i * 7 + 3} color={sparkColors[i % sparkColors.length]} still={still} />
      ))}

      <Animated.View style={[styles.stage, stageStyle]}>
        <Mark neon={neon} still={still} enter={enter} />

        <View style={styles.word}>
          {letters.map((ch, i) => (
            <Letter key={i} ch={ch} index={i} color={mix(neon.cyan, neon.pink, i / (letters.length - 1))} still={still} />
          ))}
        </View>

        <Tagline neon={neon} still={still} />
      </Animated.View>

      <Loader neon={neon} still={still} bottom={insets.bottom + 56} />

      <Text style={[styles.footer, { color: neon.textDim, bottom: insets.bottom + 22 }]} maxFontSizeMultiplier={1.2}>
        Made for India
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 48 },
  orb: { position: 'absolute' },
  spark: {
    position: 'absolute',
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  markBox: { width: OUTER_RING_SIZE, height: OUTER_RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  pulse: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
  },
  outerRing: { position: 'absolute', width: OUTER_RING_SIZE, height: OUTER_RING_SIZE },
  ring: { position: 'absolute', width: RING_SIZE, height: RING_SIZE },
  disc: { width: MARK_SIZE, height: MARK_SIZE },
  discEdge: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B026FF',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  discInner: {
    width: MARK_SIZE - 5,
    height: MARK_SIZE - 5,
    borderRadius: (MARK_SIZE - 5) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markImage: { width: MARK_SIZE * 0.74, height: MARK_SIZE * 0.74 },
  word: { flexDirection: 'row', marginTop: 30, alignItems: 'flex-end' },
  letter: {
    fontSize: 42,
    lineHeight: 50,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: -0.5,
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  taglineBox: { alignItems: 'center', marginTop: 10 },
  tagline: { fontSize: 15, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  underline: { width: 150, height: 2, borderRadius: 1, marginTop: 10, overflow: 'hidden', transformOrigin: 'left' },
  track: { position: 'absolute', alignSelf: 'center', width: 132, height: 4, borderRadius: 2, overflow: 'hidden' },
  segment: { position: 'absolute', left: 0, top: 0, width: 64, height: 4 },
  footer: { position: 'absolute', alignSelf: 'center', fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 1.2, textTransform: 'uppercase' },
});
