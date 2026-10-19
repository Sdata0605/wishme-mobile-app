import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { GradientText } from '@/components/neon/GradientText';
import { NeonCard } from '@/components/neon/NeonCard';
import { useAssistantPersona } from '@/context/AssistantPersonaContext';
import { useTheme } from '@/context/ThemeContext';
import { useVoiceAssistant } from '@/context/VoiceAssistantContext';
import { getPermissionState, request } from '@/services/permissions';

/** After this long a "Continue" button appears; after the second, the app carries on by itself. */
const SLOW_AFTER_S = 10;
const GIVE_UP_AFTER_S = 15;
/** When the voice connection fails there is no point waiting: carry on after a moment. */
const ERROR_CARRY_ON_S = 5;
const TRACK_W = 140;
const SEGMENT_W = 48;

/**
 * Shown right after a login or sign-up, before the home screen, while the voice assistant gets ready in the background (its
 * settings, the connection to the voice service, the microphone), so the first tap on the assistant is instant. It says nothing
 * about what is happening behind the scenes. It never traps anyone: a Continue button appears after 10 seconds and the app
 * carries on by itself after 15.
 */
export default function SettingUpScreen() {
  const { neon } = useTheme();
  const { next } = useLocalSearchParams<{ next?: string }>();
  // A word, not a path, so this screen can never be pointed at an arbitrary route.
  const target = next === 'home' ? '/(tabs)' : '/(tabs)/assistant';
  const { state } = useVoiceAssistant();
  const { status: personaStatus } = useAssistantPersona();

  const [mic, setMic] = useState<'checking' | 'ready'>('checking');
  const [seconds, setSeconds] = useState(0);
  const [finished, setFinished] = useState<'done' | 'carried-on' | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [slowNote, setSlowNote] = useState(false);

  const cardFade = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current;
  const noteFade = useRef(new Animated.Value(1)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;
  const left = useRef(false);

  // The microphone: read, and ask once if the phone has not been asked yet. Allowed or not, it never holds this screen up.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await getPermissionState('microphone');
        if (!m.granted && m.status === 'undetermined' && m.canAskAgain) await request('microphone');
      } catch {
        /* the assistant asks again when the user first talks */
      }
      if (!cancelled) setMic('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    AccessibilityInfo.announceForAccessibility('Setting things up for you, this will take a few seconds');
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      sub.remove();
      clearInterval(tick);
    };
  }, []);

  // The orb pulse and the sliding bar.
  useEffect(() => {
    if (finished) return;
    // With reduce motion on nothing moves: the halo and the bar stay still.
    if (reduceMotion) return;
    const beat = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const bar = Animated.loop(Animated.timing(slide, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), { resetBeforeIteration: true });
    beat.start();
    bar.start();
    return () => {
      beat.stop();
      bar.stop();
    };
  }, [pulse, slide, reduceMotion, finished]);

  const settingsReady = personaStatus !== 'loading';
  const voiceReady = state === 'ready' || state === 'listening' || state === 'speaking';
  const voiceFailed = state === 'error';
  const allDone = settingsReady && voiceReady && mic === 'ready';

  const leave = (how: 'done' | 'carried-on', holdMs: number) => {
    if (left.current) return;
    left.current = true;
    setFinished(how);
    if (how === 'done') {
      AccessibilityInfo.announceForAccessibility('All set');
      Animated.timing(fill, { toValue: 1, duration: holdMs ? 250 : 0, useNativeDriver: true }).start();
    }
    setTimeout(() => {
      Animated.timing(cardFade, { toValue: 0, duration: holdMs ? 300 : 0, useNativeDriver: true }).start(() => router.replace(target as never));
    }, holdMs);
  };

  // Everything is ready: a short moment to see it, unless it was ready at once.
  useEffect(() => {
    if (allDone) leave('done', seconds < 2 ? 0 : 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  // Never trap the user.
  const failedAt = useRef<number | null>(null);
  if (voiceFailed && failedAt.current === null) failedAt.current = seconds;
  if (!voiceFailed) failedAt.current = null;
  useEffect(() => {
    if (seconds >= GIVE_UP_AFTER_S) leave('carried-on', 0);
    else if (failedAt.current !== null && seconds - failedAt.current >= ERROR_CARRY_ON_S) leave('carried-on', 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds]);

  // After 10 seconds (or a failure) the note changes quietly and a Continue button appears.
  const slow = (seconds >= SLOW_AFTER_S || voiceFailed) && !finished;
  useEffect(() => {
    if (!slow) return;
    Animated.timing(noteFade, { toValue: 0, duration: 125, useNativeDriver: true }).start(() => {
      setSlowNote(true);
      Animated.timing(noteFade, { toValue: 1, duration: 125, useNativeDriver: true }).start();
    });
    Animated.timing(buttonFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [slow, noteFade, buttonFade]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.8] });
  const segmentX = slide.interpolate({ inputRange: [0, 1], outputRange: [-SEGMENT_W, TRACK_W] });
  const cardScale = cardFade.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] });

  const title = finished === 'done' ? 'All set!' : 'Setting things up for you';
  const note = slowNote ? "Almost there - you can carry on, we'll finish in the background." : 'This will take only a few seconds.';

  return (
    <AmbientBackground>
      <View style={styles.center}>
        <Animated.View style={{ opacity: cardFade, transform: [{ scale: cardScale }], alignSelf: 'stretch', alignItems: 'center' }}>
          <NeonCard style={styles.card} radius={28}>
            <View style={styles.hero} accessible={false} importantForAccessibility="no-hide-descendants">
              <Animated.View
                style={[
                  styles.halo,
                  { backgroundColor: finished === 'done' ? neon.success : neon.violet, opacity: reduceMotion ? 0.55 : haloOpacity, transform: [{ scale: reduceMotion ? 1 : haloScale }] },
                ]}
              />
              <Svg width={96} height={96} viewBox="0 0 96 96">
                <Defs>
                  <RadialGradient id="orb" cx="40%" cy="35%" r="70%">
                    <Stop offset="0" stopColor={neon.cyan} stopOpacity="1" />
                    <Stop offset="0.6" stopColor={neon.violet} stopOpacity="1" />
                    <Stop offset="1" stopColor={neon.pink} stopOpacity="1" />
                  </RadialGradient>
                </Defs>
                <Circle cx="48" cy="48" r="44" fill="url(#orb)" />
              </Svg>
            </View>

            <View style={{ marginTop: 24, alignItems: 'center' }}>
              <GradientText colors={neon.gVioletCyan} fontSize={22} fontFamily="PlayfairDisplay_700Bold">{title}</GradientText>
            </View>

            <View style={[styles.track, { backgroundColor: neon.cardBorder }]} accessible={false} importantForAccessibility="no-hide-descendants">
              <Animated.View style={[styles.segment, { opacity: reduceMotion ? 0.8 : 1, transform: [{ translateX: reduceMotion ? (TRACK_W - SEGMENT_W) / 2 : segmentX }] }]}>
                <LinearGradient colors={neon.gVioletCyan as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: fill }]}>
                <LinearGradient colors={neon.gVioletCyan as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              </Animated.View>
            </View>

            <Animated.Text style={[styles.note, { color: neon.textLo, opacity: noteFade }]}>{finished === 'done' ? ' ' : note}</Animated.Text>

            {slow ? (
              <Animated.View style={{ opacity: buttonFade }}>
                <Pressable onPress={() => leave('carried-on', 0)} accessibilityRole="button" accessibilityLabel="Continue" style={styles.button} hitSlop={8}>
                  <Text style={{ color: neon.textHi, fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>Continue</Text>
                </Pressable>
              </Animated.View>
            ) : null}
          </NeonCard>
        </Animated.View>
      </View>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: { width: '100%', maxWidth: 340, paddingHorizontal: 28, paddingTop: 32, paddingBottom: 24, alignItems: 'center' },
  hero: { width: 124, height: 124, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 124, height: 124, borderRadius: 62 },
  track: { width: TRACK_W, height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 20 },
  segment: { position: 'absolute', left: 0, top: 0, width: SEGMENT_W, height: 4, borderRadius: 2, overflow: 'hidden' },
  note: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 16, fontFamily: 'Inter_400Regular' },
  button: { minHeight: 44, minWidth: 120, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
});
