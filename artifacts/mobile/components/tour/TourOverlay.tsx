import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const MOVE = { duration: 200, easing: Easing.bezier(0.2, 0, 0, 1) };

interface Box { x: number; y: number; w: number; h: number; r: number }

function getTabBox(index: number, W: number, H: number, tabBarHeight: number): Box {
  const top = H - tabBarHeight;
  const tabW = (W - 84) / 4;
  if (index === 2) {
    const size = 70;
    return {
      x: W / 2 - size / 2,
      y: top - size / 2,
      w: size,
      h: size,
      r: size / 2,
    };
  }
  let cx = 0;
  if (index === 0) cx = tabW * 0.5;
  else if (index === 1) cx = tabW * 1.5;
  else if (index === 3) cx = tabW * 2 + 84 + tabW * 0.5;
  else if (index === 4) cx = tabW * 3 + 84 + tabW * 0.5;

  const pillW = 62;
  const pillH = 38;
  return {
    x: cx - pillW / 2,
    y: top + 28 - pillH / 2,
    w: pillW,
    h: pillH,
    r: pillH / 2,
  };
}

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
  const [measuredBox, setMeasuredBox] = useState<Box | null>(null);

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

  // Immediately compute tab coordinates synchronously so there is zero frame lag
  const box = useMemo<Box | null>(() => {
    if (current.target.kind === 'tab') {
      return getTabBox(current.target.index, W, H, tabBarHeight);
    }
    return measuredBox;
  }, [current, W, H, tabBarHeight, measuredBox]);

  const onLayout = useCallback(() => {
    try {
      rootRef.current?.measureInWindow((x, y) => setOrigin({ x, y }));
    } catch {
      /* the view went away mid-measure (unmounted, or a dev reload); the next layout retries */
    }
  }, []);

  // Measure ref targets when needed
  useEffect(() => {
    if (current.target.kind === 'ref') {
      if (!origin) return;
      let cancelled = false;
      const view = getTarget(current.target.id)?.current;
      if (view) {
        try {
          view.measureInWindow((x, y, w, h) => {
            if (cancelled || !w || !h) return;
            const size = Math.max(w, h) + PAD * 2;
            setMeasuredBox({
              x: x - origin.x - PAD,
              y: y - origin.y - PAD,
              w: w + PAD * 2,
              h: h + PAD * 2,
              r: Math.min(size / 2, 22),
            });
          });
        } catch {
          /* the target was unmounted before it could be measured */
        }
      }
      return () => { cancelled = true; };
    }
  }, [current, origin, getTarget]);

  // Glide spotlight to the target box smoothly
  useEffect(() => {
    if (!box) return;
    if (!placed.current) {
      placed.current = true;
      sx.value = box.x;
      sy.value = box.y;
      sw.value = box.w;
      sh.value = box.h;
      sr.value = box.r;
    } else {
      sx.value = withTiming(box.x, MOVE);
      sy.value = withTiming(box.y, MOVE);
      sw.value = withTiming(box.w, MOVE);
      sh.value = withTiming(box.h, MOVE);
      sr.value = withTiming(box.r, MOVE);
    }
  }, [box, sx, sy, sw, sh, sr]);

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

  // Calculate arrow position so the tip points directly at the target center (box.x + box.w / 2).
  // Bubble has left: 16, right: 16 (width: W - 32) and borderRadius: 18.
  // Rotated 16x16 arrow has center at left + 8.
  // Target screen center = 16 (bubble left) + arrowLeft + 8  =>  arrowLeft = targetCx - 24.
  const targetCx = box ? box.x + box.w / 2 : W / 2;
  const arrowLeft = Math.min(Math.max(targetCx - 24, 12), W - 60);

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
          entering={FadeIn.duration(150)}
          style={[styles.bubble, bubblePos, { backgroundColor: colors.card }]}
        >
          <View
            style={[
              styles.arrow,
              { left: arrowLeft, backgroundColor: colors.card },
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
                colors={['#7B5CFA', '#EC4899', '#1F7BFF']}
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
