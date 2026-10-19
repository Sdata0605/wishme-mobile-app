import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { WishTrace } from '@/components/loaders/WishTrace';
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

/**
 * Shown right after a login or sign-up, before the home screen, while the voice assistant gets ready in the background (its
 * settings, the connection to the voice service, the microphone), so the first tap on the assistant is instant. It says nothing
 * about what is happening behind the scenes: a heart being traced by a comet of light, a title and a short note. It never traps
 * anyone: a Continue button appears after 10 seconds and the app carries on by itself after 15.
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

  const settingsReady = personaStatus !== 'loading';
  const voiceReady = state === 'ready' || state === 'listening' || state === 'speaking';
  const voiceFailed = state === 'error';
  const allDone = settingsReady && voiceReady && mic === 'ready';

  const leave = (how: 'done' | 'carried-on', holdMs: number) => {
    if (left.current) return;
    left.current = true;
    setFinished(how);
    if (how === 'done') AccessibilityInfo.announceForAccessibility('All set');
    setTimeout(() => {
      Animated.timing(cardFade, { toValue: 0, duration: holdMs ? 300 : 0, useNativeDriver: true }).start(() => router.replace(target as never));
    }, holdMs);
  };

  // Everything is ready: a short moment to see it, unless it was ready at once.
  useEffect(() => {
    if (allDone) leave('done', seconds < 2 ? 0 : 700);
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

  const cardScale = cardFade.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] });
  const title = finished === 'done' ? 'All set!' : 'Setting things up for you';
  const note = slowNote ? "Almost there - you can carry on, we'll finish in the background." : 'This will take only a few seconds.';

  return (
    <AmbientBackground>
      <View style={styles.center}>
        <Animated.View style={{ opacity: cardFade, transform: [{ scale: cardScale }], alignSelf: 'stretch', alignItems: 'center' }}>
          <NeonCard style={styles.card} radius={28}>
            <WishTrace done={finished === 'done'} reduceMotion={reduceMotion} />

            <View style={{ marginTop: 20, alignItems: 'center' }}>
              <GradientText colors={neon.gVioletCyan} fontSize={22} fontFamily="PlayfairDisplay_700Bold">{title}</GradientText>
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
  card: { width: '100%', maxWidth: 340, paddingHorizontal: 28, paddingTop: 28, paddingBottom: 24, alignItems: 'center' },
  note: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 16, fontFamily: 'Inter_400Regular' },
  button: { minHeight: 44, minWidth: 120, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
});
