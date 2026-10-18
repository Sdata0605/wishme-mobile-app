import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from '@/components/GradientButton';
import { Icon, type IconName } from '@/components/Icon';
import {
  LanguagePicker,
  NameField,
  PersonalityPicker,
  VoiceList,
} from '@/components/assistant/PersonaForm';
import { cleanName, useAssistantPersona } from '@/context/AssistantPersonaContext';
import { useTheme } from '@/context/ThemeContext';
import {
  DEFAULT_PERSONA,
  LANGUAGES,
  PERSONALITIES,
  type AssistantPersona,
} from '@/services/assistant/persona';
import { AmbientBackground } from '@/components/neon/AmbientBackground';

type Draft = Omit<AssistantPersona, 'isDefault'>;

const STEPS = [
  {
    key: 'voice',
    kicker: 'Step one',
    title: 'How should it sound?',
    subtitle: 'Have a listen, then tap the voice you like best.',
    icon: 'volume-2' as IconName,
  },
  {
    key: 'name',
    kicker: 'Step two',
    title: 'Give it a name',
    subtitle: 'This is what you will call it, and what it calls itself.',
    icon: 'edit-2' as IconName,
  },
  {
    key: 'personality',
    kicker: 'Step three',
    title: 'Pick a personality',
    subtitle: 'This sets the tone of every reply.',
    icon: 'smile' as IconName,
  },
  {
    key: 'language',
    kicker: 'Last one',
    title: 'Which language?',
    subtitle: 'You can change any of this later in Settings.',
    icon: 'globe' as IconName,
  },
] as const;

/** Live preview of the persona, so the user can see the thing they are building take shape. */
function PersonaPreview({ draft }: { draft: Draft }) {
  const { colors, gradients, isDark } = useTheme();
  const name = cleanName(draft.name);
  const personality = PERSONALITIES.find((p) => p.id === draft.personality) ?? PERSONALITIES[0];
  const language = LANGUAGES.find((l) => l.id === draft.language) ?? LANGUAGES[0];

  return (
    <View style={[s.preview, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <LinearGradient
        colors={gradients.assistant as unknown as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.orb}
      >
        {name ? (
          <Text style={s.orbLetter}>{name.slice(0, 1).toUpperCase()}</Text>
        ) : (
          <Icon name="sparkles" size={22} color="#fff" />
        )}
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[s.previewName, { color: colors.foreground }]}>
          {name || 'Your assistant'}
        </Text>
        <Text numberOfLines={1} style={[s.previewMeta, { color: colors.mutedForeground }]}>
          {draft.voice} · {personality.label} · {language.label}
        </Text>
      </View>
      <View style={[s.previewBadge, { backgroundColor: isDark ? colors.muted : colors.backgroundSecondary }]}>
        <Icon name="mic" size={15} color={colors.primary} />
      </View>
    </View>
  );
}

/** First-run setup for the voice assistant. Every step can be skipped to use the default assistant. */
export default function AssistantSetupScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { persona, save, skip } = useAssistantPersona();

  const [step, setStep] = useState(0);
  // Which way the user is moving, so the incoming step slides in from the matching side.
  const [forwards, setForwards] = useState(true);
  const [draft, setDraft] = useState<Draft>({
    name: DEFAULT_PERSONA.name === persona.name ? '' : persona.name,
    voice: persona.voice,
    personality: persona.personality,
    customNote: persona.customNote,
    language: persona.language,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progress = useSharedValue(1 / STEPS.length);
  useEffect(() => {
    progress.value = withTiming((step + 1) / STEPS.length, { duration: 340 });
  }, [step, progress]);
  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as `${number}%`,
  }));

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/assistant' as never);
  };

  const onSkip = async () => {
    setBusy(true);
    await skip();
    setBusy(false);
    leave();
  };

  const onFinish = async () => {
    setBusy(true);
    setError(null);
    const err = await save({ ...draft, name: cleanName(draft.name) || DEFAULT_PERSONA.name });
    setBusy(false);
    if (err) setError(err);
    else leave();
  };

  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  const goBack = () => {
    setForwards(false);
    setStep((n) => Math.max(0, n - 1));
  };
  const goNext = () => {
    if (last) {
      void onFinish();
      return;
    }
    setForwards(true);
    setStep((n) => n + 1);
  };

  return (
    <AmbientBackground><View style={[s.container, { backgroundColor: 'transparent' }]}>
      {/* A soft wash behind the header keeps the flow feeling like one piece across the steps. */}
      <LinearGradient
        colors={[colors.primary + (isDark ? '26' : '14'), colors.background]}
        style={[s.wash, { height: insets.top + 190 }]}
        pointerEvents="none"
      />

      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={s.headerRow}>
          <Pressable
            onPress={step === 0 ? onSkip : goBack}
            disabled={busy}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={step === 0 ? 'Skip assistant setup' : 'Go back a step'}
            style={({ pressed }) => [
              s.iconBtn,
              { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Icon name={step === 0 ? 'x' : 'arrow-left'} size={19} color={colors.foreground} />
          </Pressable>

          <Text style={[s.stepCount, { color: colors.mutedForeground }]}>
            Step {step + 1} of {STEPS.length}
          </Text>

          <Pressable
            onPress={onSkip}
            disabled={busy}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Skip setup and use the default assistant"
            style={({ pressed }) => [s.skipBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[s.skipText, { color: colors.mutedForeground }]}>Skip</Text>
          </Pressable>
        </View>

        <View
          style={[s.track, { backgroundColor: isDark ? colors.muted : colors.border }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: STEPS.length, now: step + 1 }}
        >
          <Animated.View style={[s.fill, fillStyle]}>
            <LinearGradient
              colors={['#7B5CFA', '#1F7BFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.bottom : 0}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(260)}>
            <PersonaPreview draft={draft} />
          </Animated.View>

          <Animated.View
            key={current.key}
            entering={(forwards ? FadeInRight : FadeInLeft).duration(300)}
          >
            <View style={s.titleRow}>
              <View style={[s.kickerTile, { backgroundColor: colors.primary + (isDark ? '2E' : '1A') }]}>
                <Icon name={current.icon} size={16} color={colors.primary} />
              </View>
              <Text style={[s.kicker, { color: colors.primary }]}>{current.kicker}</Text>
            </View>
            <Text style={[s.title, { color: colors.foreground }]}>{current.title}</Text>
            <Text style={[s.subtitle, { color: colors.mutedForeground }]}>{current.subtitle}</Text>

            <View style={{ marginTop: 20 }}>
              {current.key === 'voice' && (
                <VoiceList value={draft.voice} onChange={(voice) => setDraft((d) => ({ ...d, voice }))} />
              )}
              {current.key === 'name' && (
                <NameField value={draft.name} onChange={(name) => setDraft((d) => ({ ...d, name }))} />
              )}
              {current.key === 'personality' && (
                <PersonalityPicker
                  personality={draft.personality}
                  customNote={draft.customNote}
                  onPersonality={(personality) => setDraft((d) => ({ ...d, personality }))}
                  onNote={(customNote) => setDraft((d) => ({ ...d, customNote }))}
                />
              )}
              {current.key === 'language' && (
                <LanguagePicker
                  value={draft.language}
                  onChange={(language) => setDraft((d) => ({ ...d, language }))}
                />
              )}
            </View>
          </Animated.View>

          {error ? (
            <View style={[s.errorBox, { backgroundColor: colors.destructive + '1A', borderColor: colors.destructive + '55' }]}>
              <Icon name="alert-circle" size={17} color={colors.destructive} />
              <Text style={[s.errorText, { color: colors.foreground }]}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <View
        style={[
          s.footer,
          { paddingBottom: insets.bottom + 14, borderTopColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <GradientButton
          title={last ? 'Meet your assistant' : 'Continue'}
          onPress={goNext}
          loading={busy}
          height={54}
          icon={<Icon name={last ? 'sparkles' : 'arrow-right'} size={18} color="#fff" />}
          textStyle={s.ctaText}
        />
        <Text style={[s.footnote, { color: colors.mutedForeground }]}>
          Skip at any time to use the default assistant.
        </Text>
      </View>
    </View></AmbientBackground>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  wash: { position: 'absolute', top: 0, left: 0, right: 0 },

  header: { paddingHorizontal: 20, paddingBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCount: { fontSize: 13, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 },
  skipBtn: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  track: { height: 6, borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, overflow: 'hidden' },

  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  orb: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  orbLetter: { color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold' },
  previewName: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  previewMeta: { fontSize: 12.5, fontFamily: 'Inter_400Regular', marginTop: 3 },
  previewBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 },
  kickerTile: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.9, textTransform: 'uppercase' },
  title: { fontSize: 28, lineHeight: 34, fontFamily: 'PlayfairDisplay_700Bold', marginTop: 10 },
  subtitle: { fontSize: 14.5, lineHeight: 21, fontFamily: 'Inter_400Regular', marginTop: 6 },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 18,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  errorText: { flex: 1, fontSize: 13.5, lineHeight: 19, fontFamily: 'Inter_500Medium' },

  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  ctaText: { fontSize: 16.5, fontFamily: 'Inter_700Bold' },
  footnote: { textAlign: 'center', fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 10 },
});
