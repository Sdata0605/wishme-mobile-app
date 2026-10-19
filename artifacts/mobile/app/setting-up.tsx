import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { AmbientBackground } from '@/components/neon/AmbientBackground';
import { GradientText } from '@/components/neon/GradientText';
import { NeonCard } from '@/components/neon/NeonCard';
import { useAssistantPersona } from '@/context/AssistantPersonaContext';
import { useTheme } from '@/context/ThemeContext';
import { useVoiceAssistant } from '@/context/VoiceAssistantContext';
import { getPermissionState, request } from '@/services/permissions';

type StepState = 'waiting' | 'working' | 'done' | 'problem';

/** After this long a "Continue" button appears; after the second, the app carries on by itself. */
const SLOW_AFTER_S = 10;
const GIVE_UP_AFTER_S = 15;
/** When the voice connection fails there is no point waiting: carry on after a moment. */
const ERROR_CARRY_ON_S = 5;

/**
 * Shown right after a login or sign-up, before the home screen, while the voice assistant gets ready (its settings, the
 * connection to the voice service, the microphone), so the first tap on the assistant is instant. It never traps anyone: a
 * Continue button appears after 10 seconds and the app carries on by itself after 15.
 */
export default function SettingUpScreen() {
  const { neon } = useTheme();
  const insets = useSafeAreaInsets();
  const { next } = useLocalSearchParams<{ next?: string }>();
  // A word, not a path, so this screen can never be pointed at an arbitrary route.
  const target = next === 'home' ? '/(tabs)' : '/(tabs)/assistant';
  const { state } = useVoiceAssistant();
  const { status: personaStatus } = useAssistantPersona();

  const [mic, setMic] = useState<'checking' | 'granted' | 'skipped'>('checking');
  const [seconds, setSeconds] = useState(0);
  const [finished, setFinished] = useState<'done' | 'carried-on' | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const left = useRef(false);

  // The microphone: read, and ask once if the phone has not been asked yet.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let m = await getPermissionState('microphone');
        if (!m.granted && m.status === 'undetermined' && m.canAskAgain) m = await request('microphone');
        if (!cancelled) setMic(m.granted ? 'granted' : 'skipped');
      } catch {
        if (!cancelled) setMic('skipped');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      sub.remove();
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  const settingsReady = personaStatus !== 'loading';
  const voiceReady = state === 'ready' || state === 'listening' || state === 'speaking';
  const voiceFailed = state === 'error';
  const micChecked = mic !== 'checking';
  const allDone = settingsReady && voiceReady && micChecked;

  const steps = useMemo(() => {
    const voice: StepState = voiceReady ? 'done' : voiceFailed ? 'problem' : settingsReady ? 'working' : 'waiting';
    const micStep: StepState = mic === 'granted' ? 'done' : mic === 'skipped' ? 'problem' : 'working';
    return [
      { key: 'signed', label: 'Signed in', state: 'done' as StepState },
      { key: 'settings', label: 'Setting up your assistant', state: (settingsReady ? 'done' : 'working') as StepState },
      { key: 'voice', label: 'Connecting your voice', state: voice },
      { key: 'mic', label: 'Microphone ready', state: micStep, help: mic === 'skipped' ? "We'll ask when you first talk" : undefined },
    ];
  }, [settingsReady, voiceReady, voiceFailed, mic]);

  const leave = (how: 'done' | 'carried-on', holdMs: number) => {
    if (left.current) return;
    left.current = true;
    setFinished(how);
    AccessibilityInfo.announceForAccessibility(how === 'done' ? 'All set' : 'Carrying on');
    setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: holdMs ? 300 : 0, useNativeDriver: true }).start(() => router.replace(target as never));
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

  // Each step reached is announced to a screen reader.
  const announced = useRef<Record<string, StepState>>({});
  useEffect(() => {
    for (const step of steps) {
      if (announced.current[step.key] !== step.state && step.state === 'done') AccessibilityInfo.announceForAccessibility(`${step.label}, done`);
      announced.current[step.key] = step.state;
    }
  }, [steps]);

  const slow = seconds >= SLOW_AFTER_S && !finished;
  const title = finished === 'done' ? 'All set!' : 'Setting things up for you';
  const subtitle = voiceFailed
    ? "We couldn't connect your voice just now. Carry on - we'll keep trying in the background."
    : slow
      ? 'Taking a little longer than usual - you can carry on, your assistant will finish getting ready.'
      : 'Getting your assistant ready. This only takes a moment.';

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.8] });

  const wellFor = (st: StepState) => {
    if (st === 'done') return <View style={[styles.well, { backgroundColor: neon.success }]}><Icon name="check" size={16} color="#04122E" /></View>;
    if (st === 'problem') return <View style={[styles.well, { backgroundColor: `${neon.warning}33`, borderColor: neon.warning, borderWidth: 1.5 }]}><Text style={{ color: neon.warning, fontSize: 15, fontFamily: 'Inter_700Bold' }}>!</Text></View>;
    if (st === 'working') return <View style={styles.well}><ActivityIndicator size="small" color={neon.violet} /></View>;
    return <View style={[styles.well, { borderColor: neon.cardBorder, borderWidth: 1.5 }]} />;
  };

  return (
    <AmbientBackground>
      <Animated.View style={[styles.wrap, { opacity: fade, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.hero} accessible={false}>
          <Animated.View style={[styles.halo, { backgroundColor: finished === 'done' ? neon.success : neon.violet, opacity: reduceMotion ? 0.55 : haloOpacity, transform: [{ scale: reduceMotion ? 1 : haloScale }] }]} />
          <Svg width={120} height={120} viewBox="0 0 120 120">
            <Defs>
              <RadialGradient id="orb" cx="40%" cy="35%" r="70%">
                <Stop offset="0" stopColor={neon.cyan} stopOpacity="1" />
                <Stop offset="0.6" stopColor={neon.violet} stopOpacity="1" />
                <Stop offset="1" stopColor={neon.pink} stopOpacity="1" />
              </RadialGradient>
            </Defs>
            <Circle cx="60" cy="60" r="52" fill="url(#orb)" />
          </Svg>
        </View>

        <View style={{ alignItems: 'center', marginTop: 28 }}>
          <GradientText colors={neon.gVioletCyan} fontSize={26} fontFamily="PlayfairDisplay_700Bold">{title}</GradientText>
        </View>
        <Text style={[styles.subtitle, { color: neon.textLo }]} accessibilityLiveRegion="polite">{subtitle}</Text>

        <NeonCard style={styles.card}>
          <View
            accessible
            accessibilityLabel={`Setting things up. ${steps.map((s) => `${s.label}: ${s.state === 'done' ? 'done' : s.state === 'problem' ? 'needs attention' : 'in progress'}`).join('. ')}`}
          >
            {steps.map((s) => (
              <View key={s.key} style={styles.row}>
                {wellFor(s.state)}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: s.state === 'waiting' ? neon.textDim : neon.textHi, fontSize: 15.5, fontFamily: 'Inter_600SemiBold' }}>{s.label}</Text>
                  {s.help ? <Text style={{ color: neon.textLo, fontSize: 12.5, fontFamily: 'Inter_400Regular', marginTop: 2 }}>{s.help}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </NeonCard>

        <View style={{ flex: 1 }} />
        {(slow || voiceFailed) && !finished ? (
          <Pressable
            onPress={() => leave('carried-on', 0)}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            style={[styles.button, { borderColor: neon.cardBorder }]}
          >
            <Text style={{ color: neon.textHi, fontSize: 16, fontFamily: 'Inter_600SemiBold' }}>Continue</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, alignItems: 'stretch' },
  hero: { alignItems: 'center', justifyContent: 'center', height: 150 },
  halo: { position: 'absolute', width: 150, height: 150, borderRadius: 75 },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10, marginHorizontal: 12, fontFamily: 'Inter_400Regular' },
  card: { marginTop: 28, paddingVertical: 8, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56 },
  well: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  button: { height: 52, borderRadius: 26, borderWidth: 1.4, alignItems: 'center', justifyContent: 'center' },
});
