import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { useVoiceAssistant } from '@/context/VoiceAssistantContext';

const ORB = 132;
const MINI = 58;
const BAR_COUNT = 15;
const PANEL_HIDE_OFFSET = 380;

// Gentle "expo out" for things arriving, symmetric ease for things leaving.
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

const STATE_LABEL = {
  idle: '',
  connecting: 'Connecting…',
  ready: '',
  listening: 'Listening',
  speaking: '',
  error: 'Tap the orb to try again',
} as const;

const tail = (text: string, max: number) => (text.length > max ? `…${text.slice(-max)}` : text);

const tick = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** Looping 0→1 value for continuous motion (runs on the native thread). */
function useLoop(duration: number, easing = Easing.linear) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v, duration, easing]);
  return v;
}

/** Round button with a generous touch target and springy press feedback. */
function RoundButton({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPressIn={() =>
        Animated.spring(scale, { toValue: 0.86, speed: 50, bounciness: 0, useNativeDriver: true }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, { toValue: 1, speed: 28, bounciness: 10, useNativeDriver: true }).start()
      }
      onPress={() => {
        tick();
        onPress();
      }}
      style={styles.hit}
    >
      <Animated.View style={[styles.hitCircle, { transform: [{ scale }] }]}>
        <Icon name={icon} size={20} color="rgba(255,255,255,0.92)" />
      </Animated.View>
    </Pressable>
  );
}

function Orb({ speaking, busy }: { speaking: boolean; busy: boolean }) {
  const { level } = useVoiceAssistant();

  const spinA = useLoop(9000);
  const spinB = useLoop(14000);
  const breathe = useLoop(3600, Easing.inOut(Easing.sin));
  const speakMix = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(speakMix, { toValue: speaking ? 1 : 0, duration: 500, easing: EASE_IN_OUT, useNativeDriver: true }).start();
  }, [speaking, speakMix]);

  const coreScale = Animated.multiply(
    Animated.add(1, Animated.multiply(level, 0.5)),
    breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.97, 1.035, 0.97] }),
  );
  const ringScale1 = Animated.add(1.16, Animated.multiply(level, 0.8));
  const ringScale2 = Animated.add(1.38, Animated.multiply(level, 1.25));
  const spinADeg = spinA.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spinBDeg = spinB.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const listenOpacity = speakMix.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <View style={styles.orbWrap} pointerEvents="none">
      <Animated.View style={[styles.ring, { transform: [{ scale: ringScale2 }], opacity: 0.1 }]} />
      <Animated.View style={[styles.ring, { transform: [{ scale: ringScale1 }], opacity: 0.2 }]} />

      <Animated.View style={[styles.orb, { transform: [{ scale: coreScale }], opacity: busy ? 0.7 : 1 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: listenOpacity }]}>
          <LinearGradient colors={['#E8527A', '#C04CFF', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: speakMix }]}>
          <LinearGradient colors={['#FFB347', '#FF6B33', '#E8527A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>

        <Animated.View style={[styles.swirl, { transform: [{ rotate: spinADeg }] }]}>
          <LinearGradient colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{ x: 0.1, y: 0.1 }} end={{ x: 0.9, y: 0.7 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View style={[styles.swirlSmall, { transform: [{ rotate: spinBDeg }] }]}>
          <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View style={styles.sheen} />
      </Animated.View>
    </View>
  );
}

/** Equaliser bars that move with whoever is talking. */
function Bars({ color }: { color: string }) {
  const { level } = useVoiceAssistant();
  const phase = useLoop(1600);

  const bars = useMemo(
    () =>
      Array.from({ length: BAR_COUNT }, (_, i) => {
        const envelope = 0.35 + 0.65 * Math.sin((Math.PI * (i + 0.5)) / BAR_COUNT);
        const SEG = 8;
        const shift = Math.round((i / BAR_COUNT) * SEG * 1.5);
        const base = Array.from({ length: SEG }, (_, j) => (Math.sin((2 * Math.PI * j) / SEG) + 1) / 2);
        const wave = phase.interpolate({
          inputRange: Array.from({ length: SEG + 1 }, (_, k) => k / SEG),
          outputRange: Array.from({ length: SEG + 1 }, (_, k) => 0.2 + 0.8 * base[(k + shift) % SEG]),
        });
        return Animated.add(0.1, Animated.multiply(Animated.multiply(level, envelope * 2.3), wave));
      }),
    [level, phase],
  );

  return (
    <View style={styles.bars} pointerEvents="none">
      {bars.map((scaleY, i) => (
        <Animated.View key={i} style={[styles.bar, { backgroundColor: color, transform: [{ scaleY }] }]} />
      ))}
    </View>
  );
}

/** Small floating orb: the assistant is still live, just out of the way. */
function MiniOrb({ progress }: { progress: Animated.Value }) {
  const insets = useSafeAreaInsets();
  const { state, assistantText, userText, level, setMinimized, close } = useVoiceAssistant();
  const speaking = state === 'speaking';

  const spin = useLoop(7000);
  const breathe = useLoop(2800, Easing.inOut(Easing.sin));
  const speakMix = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(speakMix, { toValue: speaking ? 1 : 0, duration: 400, easing: EASE_IN_OUT, useNativeDriver: true }).start();
  }, [speaking, speakMix]);

  const scale = Animated.multiply(
    Animated.add(1, Animated.multiply(level, 0.42)),
    breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.96, 1.04, 0.96] }),
  );
  const ringScale = Animated.add(1.22, Animated.multiply(level, 0.85));
  const deg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const listenOpacity = speakMix.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  // A short live caption beside the orb that fades a few seconds after the last words.
  const caption = assistantText || userText;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!caption) return;
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 600, easing: EASE_IN_OUT, useNativeDriver: true }).start();
    }, 4500);
    return () => clearTimeout(t);
  }, [caption, fade]);

  const pop = progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <View testID="assistant-mini" style={[styles.miniWrap, { bottom: insets.bottom + 92 }]} pointerEvents="box-none">
      {caption ? (
        <Animated.View style={[styles.miniCaption, { opacity: Animated.multiply(fade, progress) }]} pointerEvents="none">
          <Text style={styles.miniCaptionText} numberOfLines={2}>
            {tail(caption, 70)}
          </Text>
        </Animated.View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open the assistant"
        onPress={() => {
          tick();
          setMinimized(false);
        }}
        onLongPress={() => {
          tick();
          close();
        }}
        delayLongPress={550}
        hitSlop={10}
      >
        <Animated.View style={[styles.miniBox, { opacity: progress, transform: [{ scale: pop }] }]}>
          <Animated.View style={[styles.miniRing, { transform: [{ scale: ringScale }], opacity: 0.22 }]} />
          <Animated.View style={[styles.miniOrb, { transform: [{ scale }] }]}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: listenOpacity }]}>
              <LinearGradient colors={['#E8527A', '#C04CFF', '#7C3AED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: speakMix }]}>
              <LinearGradient colors={['#FFB347', '#FF6B33', '#E8527A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <Animated.View style={[styles.miniSwirl, { transform: [{ rotate: deg }] }]}>
              <LinearGradient colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{ x: 0.1, y: 0.1 }} end={{ x: 0.9, y: 0.7 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
            <View style={styles.miniSheen} />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

export function AssistantOverlay() {
  const insets = useSafeAreaInsets();
  const { open, minimized, setMinimized, state, userText, assistantText, actionLabel, error, close, retry } =
    useVoiceAssistant();

  const mode: 'closed' | 'panel' | 'mini' = !open ? 'closed' : minimized ? 'mini' : 'panel';

  // panel / mini: 0 = hidden, 1 = shown. drag: finger offset while swiping the panel down.
  const panel = useRef(new Animated.Value(0)).current;
  const mini = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const [panelMounted, setPanelMounted] = useState(false);
  const [miniMounted, setMiniMounted] = useState(false);
  // Opened but not yet listening: say "Connecting…" from the first moment, and admit it when it takes long.
  const waiting = open && state !== 'listening' && state !== 'speaking' && state !== 'error';
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waiting) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(t);
  }, [waiting]);

  useEffect(() => {
    if (mode === 'panel') {
      setPanelMounted(true);
      drag.setValue(0);
      Animated.parallel([
        Animated.timing(panel, { toValue: 1, duration: 480, easing: EASE_OUT, useNativeDriver: true }),
        Animated.timing(mini, { toValue: 0, duration: 180, easing: EASE_IN_OUT, useNativeDriver: true }),
      ]).start(({ finished }) => finished && setMiniMounted(false));
    } else if (mode === 'mini') {
      setMiniMounted(true);
      Animated.parallel([
        Animated.timing(panel, { toValue: 0, duration: 360, easing: EASE_IN_OUT, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(120),
          Animated.spring(mini, { toValue: 1, damping: 15, stiffness: 190, mass: 0.8, useNativeDriver: true }),
        ]),
      ]).start(({ finished }) => {
        if (finished) {
          setPanelMounted(false);
          drag.setValue(0);
        }
      });
    } else {
      Animated.parallel([
        Animated.timing(panel, { toValue: 0, duration: 280, easing: EASE_IN_OUT, useNativeDriver: true }),
        Animated.timing(mini, { toValue: 0, duration: 200, easing: EASE_IN_OUT, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) {
          setPanelMounted(false);
          setMiniMounted(false);
          drag.setValue(0);
        }
      });
    }
  }, [mode, panel, mini, drag]);

  // Android back button turns the assistant off while the full panel is up.
  useEffect(() => {
    if (mode !== 'panel') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [mode, close]);

  // Swipe the caption/orb area down to tuck the panel away (the buttons are NOT inside it).
  const minimizeRef = useRef(() => {});
  minimizeRef.current = () => setMinimized(true);
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && g.dy > Math.abs(g.dx) * 1.3,
      onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.7) {
          tick();
          minimizeRef.current();
        } else {
          Animated.spring(drag, { toValue: 0, speed: 20, bounciness: 6, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, { toValue: 0, speed: 20, bounciness: 6, useNativeDriver: true }).start();
      },
    }),
  ).current;

  if (!panelMounted && !miniMounted) return null;

  const speaking = state === 'speaking';
  const busy = state === 'connecting' || waiting;
  const label = error ?? (waiting ? (slow ? 'Still connecting…' : 'Connecting…') : STATE_LABEL[state]);
  const caption = assistantText || userText;

  const translateY = Animated.add(
    panel.interpolate({ inputRange: [0, 1], outputRange: [PANEL_HIDE_OFFSET, 0] }),
    drag,
  );
  const panelOpacity = Animated.multiply(
    panel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.85, 1] }),
    drag.interpolate({ inputRange: [0, 220], outputRange: [1, 0.55], extrapolate: 'clamp' }),
  );

  return (
    <View testID="assistant-overlay" style={styles.root} pointerEvents="box-none">
      {panelMounted && (
        <Animated.View
          style={[styles.panel, { opacity: panelOpacity, transform: [{ translateY }] }]}
          pointerEvents={mode === 'panel' ? 'auto' : 'none'}
        >
          <LinearGradient
            colors={['rgba(10,8,28,0)', 'rgba(10,8,28,0.88)', 'rgba(8,6,22,0.97)']}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          <View style={[styles.content, { paddingBottom: insets.bottom + 18 }]}>
            {/* Swipe-down area: caption + orb */}
            <View style={styles.swipeArea} {...swipe.panHandlers}>
              <View style={styles.grabber} />
              {actionLabel ? (
                <View style={styles.chip}>
                  <Icon name="sparkles" size={13} color="#FFB48A" />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {actionLabel}
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.caption, !assistantText && styles.captionUser]} numberOfLines={4}>
                {caption ? tail(caption, 170) : label || ' '}
              </Text>
              {caption && label ? <Text style={styles.status}>{label}</Text> : null}
              {userText && assistantText ? (
                <Text style={styles.userEcho} numberOfLines={1}>
                  “{tail(userText, 60)}”
                </Text>
              ) : null}

              <Pressable onPress={state === 'error' ? retry : undefined} disabled={state !== 'error'}>
                <Orb speaking={speaking} busy={busy} />
              </Pressable>
              <Bars color={speaking ? '#FF9A6B' : '#F06A8F'} />
            </View>

            {/* Buttons live OUTSIDE the swipe area so a drag can never swallow a tap */}
            <View style={styles.header} pointerEvents="box-none">
              <RoundButton testID="assistant-minimize" icon="chevron-down" label="Minimise the assistant" onPress={() => setMinimized(true)} />
              <RoundButton testID="assistant-close" icon="x" label="Turn the assistant off" onPress={close} />
            </View>
          </View>
        </Animated.View>
      )}

      {miniMounted && <MiniOrb progress={mini} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 9999, elevation: 30 },
  panel: { width: '100%' },
  content: { alignItems: 'center', paddingHorizontal: 24 },
  swipeArea: { alignItems: 'center', paddingTop: 70, width: '100%' },
  grabber: {
    position: 'absolute',
    top: 14,
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  header: {
    position: 'absolute',
    top: 28,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  hit: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  hitCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    marginBottom: 12,
    maxWidth: '86%',
  },
  chipText: { color: '#fff', fontSize: 12.5, fontFamily: 'Inter_500Medium' },
  caption: {
    color: '#fff',
    fontSize: 21,
    lineHeight: 28,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
    minHeight: 30,
  },
  captionUser: { color: 'rgba(255,255,255,0.65)', fontFamily: 'Inter_500Medium', fontSize: 18 },
  status: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 6, fontFamily: 'Inter_500Medium', letterSpacing: 0.4 },
  userEcho: { color: 'rgba(255,255,255,0.4)', fontSize: 12.5, marginTop: 4, fontFamily: 'Inter_400Regular' },
  orbWrap: { width: ORB * 1.9, height: ORB * 1.9, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ring: { position: 'absolute', width: ORB, height: ORB, borderRadius: ORB / 2, backgroundColor: '#C27BFF' },
  orb: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    overflow: 'hidden',
    shadowColor: '#B44CFF',
    shadowOpacity: 0.7,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  swirl: { position: 'absolute', width: ORB * 1.3, height: ORB * 0.75, top: ORB * 0.1, left: -ORB * 0.15, borderRadius: ORB },
  swirlSmall: { position: 'absolute', width: ORB * 0.9, height: ORB * 0.5, top: ORB * 0.45, left: ORB * 0.3, borderRadius: ORB },
  sheen: {
    position: 'absolute',
    top: ORB * 0.08,
    left: ORB * 0.2,
    width: ORB * 0.5,
    height: ORB * 0.22,
    borderRadius: ORB,
    backgroundColor: 'rgba(255,255,255,0.22)',
    transform: [{ rotate: '-24deg' }],
  },
  bars: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 44, marginTop: -8 },
  bar: { width: 4, height: 40, borderRadius: 2, opacity: 0.9 },
  miniWrap: {
    position: 'absolute',
    right: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    zIndex: 9999,
    elevation: 30,
  },
  miniBox: { width: MINI * 1.5, height: MINI * 1.5, alignItems: 'center', justifyContent: 'center' },
  miniRing: { position: 'absolute', width: MINI, height: MINI, borderRadius: MINI / 2, backgroundColor: '#C27BFF' },
  miniOrb: {
    width: MINI,
    height: MINI,
    borderRadius: MINI / 2,
    overflow: 'hidden',
    shadowColor: '#B44CFF',
    shadowOpacity: 0.7,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  miniSwirl: { position: 'absolute', width: MINI * 1.3, height: MINI * 0.75, top: MINI * 0.1, left: -MINI * 0.15, borderRadius: MINI },
  miniSheen: {
    position: 'absolute',
    top: MINI * 0.1,
    left: MINI * 0.2,
    width: MINI * 0.45,
    height: MINI * 0.2,
    borderRadius: MINI,
    backgroundColor: 'rgba(255,255,255,0.25)',
    transform: [{ rotate: '-24deg' }],
  },
  miniCaption: {
    flexShrink: 1,
    maxWidth: '68%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(14,10,34,0.88)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  miniCaptionText: { color: '#fff', fontSize: 13, lineHeight: 18, fontFamily: 'Inter_500Medium' },
});
