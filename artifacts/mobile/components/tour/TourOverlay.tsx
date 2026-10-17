import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { useTheme } from '@/context/ThemeContext';
import { TOUR_STEPS, useTour, type TourStep } from '@/context/TourContext';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const PAD = 6;
const GAP = 14;
const MOVE = { duration: 320, easing: Easing.bezier(0.22, 1, 0.36, 1) };

interface Box { x: number; y: number; w: number; h: number; r: number }

/**
 * First-run walkthrough: dims Home, cuts a spotlight around the current target and shows a floating
 * message with Next / Skip. Mounts nothing at all unless the tour is running.
 *
 * Header targets are measured; the five bottom-bar buttons are positioned from the bar's geometry
 * (the bar is full width and its visible tabs share it equally).
 */
export function TourOverlay({ tabBarHeight }: { tabBarHeight: number }) {
  const { visible, step, next, skip } = useTour();
  if (!visible) return null;
  return <TourLayer step={step} next={next} skip={skip} tabBarHeight={tabBarHeight} />;
}

function TourLayer({
  step,
  next,
  skip,
  tabBarHeight,
}: {
  step: number;
  next: () => void;
  skip: () => void;
  tabBarHeight: number;
}) {
  const { colors } = useTheme();
  const { width: W, height: H } = useWindowDimensions();
  const { getTarget } = useTour();
  const rootRef = useRef<View>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState<Box | null>(null);

  // Spotlight — animated on the UI thread so it glides between steps.
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const sw = useSharedValue(0);
  const sh = useSharedValue(0);
  const sr = useSharedValue(0);
  const placed = useRef(false);

  const animatedProps = useAnimatedProps(() => ({
    x: sx.value,
    y: sy.value,
    width: sw.value,
    height: sh.value,
    rx: sr.value,
    ry: sr.value,
  }));

  const current: TourStep = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  const onLayout = useCallback(() => {
    try {
      rootRef.current?.measureInWindow((x, y) => setOrigin({ x, y }));
    } catch {
      /* the view went away mid-measure (unmounted, or a dev reload); the next layout retries */
    }
  }, []);

  useEffect(() => {
    if (!origin) return;
    let cancelled = false;

    const apply = (b: Box) => {
      if (cancelled) return;
      setBox(b);
      if (!placed.current) {
        placed.current = true;
        sx.value = b.x; sy.value = b.y; sw.value = b.w; sh.value = b.h; sr.value = b.r;
      } else {
        sx.value = withTiming(b.x, MOVE);
        sy.value = withTiming(b.y, MOVE);
        sw.value = withTiming(b.w, MOVE);
        sh.value = withTiming(b.h, MOVE);
        sr.value = withTiming(b.r, MOVE);
      }
    };

    const t = current.target;
    if (t.kind === 'tab') {
      const slot = W / 5;
      const top = H - tabBarHeight;
      if (t.index === 2) {
        // The assistant orb stands taller than the other buttons.
        apply({ x: t.index * slot + 4, y: top - 16, w: slot - 8, h: tabBarHeight + 8, r: 22 });
      } else {
        apply({ x: t.index * slot + 4, y: top + 2, w: slot - 8, h: tabBarHeight - 4, r: 18 });
      }
    } else {
      const view = getTarget(t.id)?.current;
      if (view) {
        try {
          view.measureInWindow((x, y, w, h) => {
            if (cancelled || !w || !h) return;
            const size = Math.max(w, h) + PAD * 2;
            apply({
              x: x - origin.x - PAD,
              y: y - origin.y - PAD,
              w: w + PAD * 2,
              h: h + PAD * 2,
              r: Math.min(size / 2, 22),
            });
          });
        } catch {
          /* the target was unmounted before it could be measured; the tour simply keeps its last spot */
        }
      }
    }
    return () => { cancelled = true; };
  }, [origin, current, W, H, tabBarHeight, getTarget, sx, sy, sw, sh, sr]);

  // The system back button skips the tour instead of leaving Home.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { skip(); return true; });
    return () => sub.remove();
  }, [skip]);

  const onNext = () => {
    Haptics.selectionAsync().catch(() => {});
    next();
  };

  // Message goes below a target in the top half of the screen, above one in the bottom half.
  const below = box ? box.y + box.h / 2 < H / 2 : true;
  const bubblePos = box
    ? below
      ? { top: box.y + box.h + GAP }
      : { bottom: H - box.y + GAP }
    : { top: H / 2 };
  const arrowLeft = box ? Math.min(Math.max(box.x + box.w / 2 - 8, 28), W - 28 - 16) : 28;

  return (
    <Animated.View
      ref={rootRef as never}
      onLayout={onLayout}
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(160)}
      style={styles.root}
      collapsable={false}
    >
      {/* Swallow touches so the screen underneath can't be used mid-tour. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} accessible={false} />

      <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Mask id="tour-hole" x="0" y="0" width={W} height={H}>
            <Rect x="0" y="0" width={W} height={H} fill="#fff" />
            <AnimatedRect animatedProps={animatedProps} fill="#000" />
          </Mask>
        </Defs>
        <Rect x="0" y="0" width={W} height={H} fill="rgba(8,10,18,0.78)" mask="url(#tour-hole)" />
      </Svg>

      {box ? (
        <Animated.View
          key={current.id}
          entering={FadeInDown.duration(260).delay(120)}
          style={[styles.bubble, bubblePos, { backgroundColor: colors.card }]}
        >
          <View
            style={[
              styles.arrow,
              { left: arrowLeft - 16, backgroundColor: colors.card },
              below ? { top: -7 } : { bottom: -7 },
            ]}
          />
          <Text style={[styles.title, { color: colors.foreground }]}>{current.title}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{current.body}</Text>

          <View style={styles.footer}>
            <Pressable onPress={skip} hitSlop={10} style={styles.skipBtn} accessibilityRole="button">
              <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
            </Pressable>

            <View style={styles.dots}>
              {TOUR_STEPS.map((s, i) => (
                <View
                  key={s.id}
                  style={[
                    styles.dot,
                    { backgroundColor: i === step ? colors.primary : colors.border },
                    i === step && styles.dotActive,
                  ]}
                />
              ))}
            </View>

            <Pressable onPress={onNext} accessibilityRole="button">
              <LinearGradient
                colors={['#B026FF', '#EC4899', '#FF5F1F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.nextBtn}
              >
                <Text style={styles.nextText}>{isLast ? 'Got it' : 'Next'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  bubble: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  arrow: {
    position: 'absolute',
    width: 16,
    height: 16,
    transform: [{ rotate: '45deg' }],
    borderRadius: 3,
  },
  title: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  body: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  skipBtn: { paddingVertical: 8, paddingRight: 12 },
  skipText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 16 },
  nextBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 9999 },
  nextText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
});
