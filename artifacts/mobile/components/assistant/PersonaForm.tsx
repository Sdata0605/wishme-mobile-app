/**
 * Building blocks for choosing the assistant's voice, name, personality and language.
 * Used by both the first-run setup screens and the Settings → AI Assistant tab.
 *
 * Every choice is a card rather than a radio row: on a phone a card is far easier to hit, and
 * the icon and colour give each option an identity the user can recognise at a glance.
 */

import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Icon, type IconName } from '@/components/Icon';
import { choiceAccents, choiceGradients } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
import {
  LANGUAGES,
  MAX_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  PERSONALITIES,
  VOICES,
  type LanguageId,
  type PersonalityId,
  type VoiceOption,
} from '@/services/assistant/persona';

const buzz = () => {
  Haptics.selectionAsync().catch(() => {});
};

/** Anything tappable is at least this tall, so it clears the 44pt minimum touch target. */
const TAP = 44;

// ─── Voice sample playback ───────────────────────────────────────────────────

/**
 * Plays one voice sample at a time.
 *
 * A sample takes a moment to load, so the card it was tapped on reports `loadingId` and shows a
 * spinner. Tapping another card during that wait abandons the first load: each attempt carries a
 * request number, and a sample that finishes loading after its number is stale is thrown away
 * unheard instead of starting. Without this, tapping several cards gave no feedback at all and
 * then played every sample at once.
 */
export function useVoiceSamples() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const requestRef = useRef(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  /** Stops what is playing and abandons whatever is still loading. */
  const stop = useCallback(async () => {
    requestRef.current += 1;
    const sound = soundRef.current;
    soundRef.current = null;
    setPlayingId(null);
    setLoadingId(null);
    if (sound) {
      try {
        await sound.stopAsync();
      } catch {
        /* already stopped */
      }
      try {
        await sound.unloadAsync();
      } catch {
        /* already unloaded */
      }
    }
  }, []);

  const toggle = useCallback(
    async (voice: VoiceOption) => {
      // Tapping the card that is playing, or the one being waited on, means "stop".
      const sameCard = playingId === voice.id || loadingId === voice.id;
      await stop();
      if (sameCard) return;

      const request = requestRef.current;
      setLoadingId(voice.id);
      try {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        // Loaded paused, so a sample that lost the race never makes a sound.
        const { sound } = await Audio.Sound.createAsync(voice.sample, { shouldPlay: false });
        if (requestRef.current !== request) {
          void sound.unloadAsync().catch(() => {});
          return;
        }
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            if (soundRef.current === sound) {
              soundRef.current = null;
              setPlayingId(null);
            }
            sound.unloadAsync().catch(() => {});
          }
        });
        setLoadingId(null);
        setPlayingId(voice.id);
        await sound.playAsync();
      } catch {
        if (requestRef.current === request) {
          setLoadingId(null);
          setPlayingId(null);
        }
      }
    },
    [playingId, loadingId, stop],
  );

  // Never keep playing after the screen goes away.
  useEffect(() => () => void stop(), [stop]);

  return { playingId, loadingId, toggle, stop };
}

// ─── Shared card chrome ─────────────────────────────────────────────────────

/** Expanding ring behind a voice avatar: the only motion on screen while a sample plays. */
function PulseRing({ color }: { color: string }) {
  const grow = useSharedValue(0);

  useEffect(() => {
    grow.value = 0;
    grow.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [grow]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - grow.value),
    transform: [{ scale: 1 + grow.value * 0.6 }],
  }));

  return <Animated.View pointerEvents="none" style={[s.pulse, { borderColor: color }, style]} />;
}

function SelectedTick({ color }: { color: string }) {
  return (
    <View style={[s.tick, { backgroundColor: color }]}>
      <Icon name="check" size={13} color="#fff" />
    </View>
  );
}

// ─── Voice list ──────────────────────────────────────────────────────────────

const gradientFor = (index: number) => choiceGradients[index % choiceGradients.length];

function VoiceCard({
  voice,
  index,
  selected,
  playing,
  loading,
  onSelect,
  onToggleSample,
}: {
  voice: VoiceOption;
  index: number;
  selected: boolean;
  playing: boolean;
  loading: boolean;
  onSelect: () => void;
  onToggleSample: () => void;
}) {
  const { colors, isDark } = useTheme();
  const accent = gradientFor(index)[0];

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${voice.id} voice, ${voice.tone}`}
      style={({ pressed }) => [
        s.voiceCard,
        {
          backgroundColor: colors.card,
          borderColor: selected ? accent : colors.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      {selected ? (
        <View
          pointerEvents="none"
          style={[s.cardWash, { backgroundColor: accent, opacity: isDark ? 0.14 : 0.07 }]}
        />
      ) : null}

      <View style={s.voiceTop}>
        <View style={s.avatarWrap}>
          {playing ? <PulseRing color={accent} /> : null}
          <LinearGradient
            colors={gradientFor(index) as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.avatar}
          >
            <Text style={s.avatarLetter}>{voice.id.slice(0, 1)}</Text>
          </LinearGradient>
        </View>
        {selected ? <SelectedTick color={accent} /> : null}
      </View>

      <Text numberOfLines={1} style={[s.voiceName, { color: colors.foreground }]}>
        {voice.id}
      </Text>
      <Text numberOfLines={2} style={[s.voiceTone, { color: colors.mutedForeground }]}>
        {voice.tone}
      </Text>

      <Pressable
        onPress={onToggleSample}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={
          loading
            ? `Loading the ${voice.id} sample`
            : playing
              ? `Stop the ${voice.id} sample`
              : `Play the ${voice.id} sample`
        }
        accessibilityState={{ busy: loading }}
        style={({ pressed }) => [
          s.listenBtn,
          {
            backgroundColor: playing || loading ? accent : isDark ? colors.muted : accent + '14',
            borderColor: playing || loading ? accent : accent + '55',
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" style={s.listenSpinner} />
        ) : (
          <Icon name={playing ? 'pause' : 'play'} size={13} color={playing ? '#fff' : accent} />
        )}
        <Text style={[s.listenText, { color: playing || loading ? '#fff' : accent }]}>
          {loading ? 'Loading…' : playing ? 'Playing' : 'Listen'}
        </Text>
      </Pressable>
    </Pressable>
  );
}

export function VoiceList({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { colors } = useTheme();
  const { playingId, loadingId, toggle } = useVoiceSamples();

  const group = (gender: VoiceOption['gender'], title: string) => (
    <View key={gender} style={{ marginBottom: 4 }}>
      <Text style={[s.groupTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={s.grid}>
        {VOICES.map((voice, index) => ({ voice, index }))
          .filter(({ voice }) => voice.gender === gender)
          .map(({ voice, index }) => (
            <VoiceCard
              key={voice.id}
              voice={voice}
              index={index}
              selected={value === voice.id}
              playing={playingId === voice.id}
              loading={loadingId === voice.id}
              onSelect={() => {
                buzz();
                onChange(voice.id);
              }}
              onToggleSample={() => {
                buzz();
                void toggle(voice);
              }}
            />
          ))}
      </View>
    </View>
  );

  return (
    <View>
      {group('female', 'Female voices')}
      {group('male', 'Male voices')}
      <Text style={[s.hint, { color: colors.mutedForeground }]}>
        Every sample is recorded with the real assistant, so what you hear is what you get.
      </Text>
    </View>
  );
}

// ─── Name ────────────────────────────────────────────────────────────────────

export const NAME_SUGGESTIONS = ['Aria', 'Nova', 'Maya', 'Sia', 'Leo', 'Jarvis', 'Zara', 'Max'];

export function NameField({
  value,
  onChange,
  showSuggestions = true,
}: {
  value: string;
  onChange: (name: string) => void;
  showSuggestions?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <View
        style={[
          s.nameShell,
          {
            backgroundColor: colors.card,
            borderColor: focused ? colors.primary : colors.border,
            borderWidth: focused ? 2 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        <LinearGradient
          colors={['#FF6B33', '#B44CFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.nameBadge}
        >
          <Icon name="sparkles" size={18} color="#fff" />
        </LinearGradient>
        <TextInput
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="e.g. Aria"
          placeholderTextColor={colors.mutedForeground}
          maxLength={MAX_NAME_LENGTH}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel="Assistant name"
          style={[s.nameInput, { color: colors.foreground }]}
        />
        {value.length ? (
          <Pressable
            onPress={() => onChange('')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Clear the name"
            style={[s.clearBtn, { backgroundColor: isDark ? colors.muted : colors.backgroundSecondary }]}
          >
            <Icon name="x" size={14} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {showSuggestions ? (
        <>
          <Text style={[s.groupTitle, { color: colors.mutedForeground, marginTop: 20 }]}>
            Or pick one of these
          </Text>
          <View style={s.chipWrap}>
            {NAME_SUGGESTIONS.map((n) => {
              const selected = value === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => {
                    buzz();
                    onChange(n);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Use the name ${n}`}
                  style={({ pressed }) => [
                    s.chip,
                    {
                      backgroundColor: selected ? colors.primary : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={[s.chipText, { color: selected ? '#fff' : colors.foreground }]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

// ─── Personality ─────────────────────────────────────────────────────────────

/**
 * Icon and colour per personality. Kept here rather than in `persona.ts` so the data model stays
 * free of presentation concerns.
 */
const PERSONALITY_LOOK: Record<PersonalityId, { icon: IconName; accent: string }> = {
  friendly: { icon: 'smile', accent: choiceAccents.orange },
  professional: { icon: 'briefcase', accent: choiceAccents.blue },
  funny: { icon: 'sparkles', accent: choiceAccents.pink },
  calm: { icon: 'moon', accent: choiceAccents.cyan },
  energetic: { icon: 'zap', accent: choiceAccents.amber },
  custom: { icon: 'edit-2', accent: choiceAccents.purple },
};

export function PersonalityPicker({
  personality,
  customNote,
  onPersonality,
  onNote,
}: {
  personality: PersonalityId;
  customNote: string;
  onPersonality: (id: PersonalityId) => void;
  onNote: (note: string) => void;
}) {
  const { colors, isDark } = useTheme();

  return (
    <View>
      <View style={s.grid}>
        {PERSONALITIES.map((option) => {
          const selected = personality === option.id;
          const { icon, accent } = PERSONALITY_LOOK[option.id];
          return (
            <Pressable
              key={option.id}
              onPress={() => {
                buzz();
                onPersonality(option.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label}: ${option.blurb}`}
              style={({ pressed }) => [
                s.personaCard,
                {
                  backgroundColor: colors.card,
                  borderColor: selected ? accent : colors.border,
                  borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
            >
              {selected ? (
                <View
                  pointerEvents="none"
                  style={[s.cardWash, { backgroundColor: accent, opacity: isDark ? 0.14 : 0.07 }]}
                />
              ) : null}
              <View style={s.voiceTop}>
                <View style={[s.iconTile, { backgroundColor: accent + (isDark ? '2E' : '1A') }]}>
                  <Icon name={icon} size={20} color={accent} />
                </View>
                {selected ? <SelectedTick color={accent} /> : null}
              </View>
              <Text style={[s.voiceName, { color: colors.foreground }]}>{option.label}</Text>
              <Text style={[s.voiceTone, { color: colors.mutedForeground }]}>{option.blurb}</Text>
            </Pressable>
          );
        })}
      </View>

      {personality === 'custom' ? (
        <View style={{ marginTop: 14 }}>
          <TextInput
            value={customNote}
            onChangeText={onNote}
            placeholder="e.g. Talk like a cheerful best friend and keep it short"
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={MAX_NOTE_LENGTH}
            accessibilityLabel="Describe your assistant's personality"
            style={[
              s.noteInput,
              { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
            ]}
          />
          <Text style={[s.hint, { color: colors.mutedForeground, textAlign: 'right' }]}>
            {customNote.length}/{MAX_NOTE_LENGTH}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Language ────────────────────────────────────────────────────────────────

/** A plain-words version of each language rule, so the choice is obvious without jargon. */
const LANGUAGE_BLURB: Record<LanguageId, string> = {
  auto: 'Replies in whichever language you speak',
  english: 'Always replies in English',
  hindi: 'Always replies in Hindi',
  hinglish: 'Hindi and English, mixed naturally',
};

export function LanguagePicker({
  value,
  onChange,
}: {
  value: LanguageId;
  onChange: (id: LanguageId) => void;
}) {
  const { colors, isDark } = useTheme();
  const accent = colors.secondary;

  return (
    <View style={{ gap: 10 }}>
      {LANGUAGES.map((language) => {
        const selected = value === language.id;
        return (
          <Pressable
            key={language.id}
            onPress={() => {
              buzz();
              onChange(language.id);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${language.label}: ${LANGUAGE_BLURB[language.id]}`}
            style={({ pressed }) => [
              s.languageRow,
              {
                backgroundColor: colors.card,
                borderColor: selected ? accent : colors.border,
                borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            {selected ? (
              <View
                pointerEvents="none"
                style={[s.cardWash, { backgroundColor: accent, opacity: isDark ? 0.14 : 0.07 }]}
              />
            ) : null}
            <View style={[s.iconTile, { backgroundColor: accent + (isDark ? '2E' : '1A') }]}>
              <Icon name="globe" size={20} color={accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.voiceName, { color: colors.foreground }]}>{language.label}</Text>
              <Text style={[s.voiceTone, { color: colors.mutedForeground }]}>
                {LANGUAGE_BLURB[language.id]}
              </Text>
            </View>
            {selected ? <SelectedTick color={accent} /> : <View style={[s.radio, { borderColor: colors.border }]} />}
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionLabel({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: 24, marginBottom: 12 }}>
      <Text style={[s.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {subtitle ? <Text style={[s.sectionSub, { color: colors.mutedForeground }]}>{subtitle}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  groupTitle: {
    fontSize: 11.5,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.9,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cardWash: { ...StyleSheet.absoluteFillObject, borderRadius: 18 },

  voiceCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 160,
    borderRadius: 18,
    padding: 12,
    overflow: 'hidden',
  },
  voiceTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  avatarWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold' },
  pulse: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  tick: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  voiceName: { fontSize: 15.5, fontFamily: 'Inter_700Bold', marginTop: 10 },
  voiceTone: { fontSize: 12.5, lineHeight: 17, fontFamily: 'Inter_400Regular', marginTop: 2 },
  listenBtn: {
    marginTop: 'auto',
    height: TAP - 8,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  listenText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  // Sized to the play icon it replaces, so the row does not jump while a sample loads.
  listenSpinner: { width: 13, height: 13 },
  hint: { fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: 8 },

  nameShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    minHeight: 64,
  },
  nameBadge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  nameInput: { flex: 1, fontSize: 19, fontFamily: 'Inter_600SemiBold', paddingVertical: 12 },
  clearBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: TAP,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 14.5, fontFamily: 'Inter_600SemiBold' },

  personaCard: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 124,
    borderRadius: 18,
    padding: 14,
    overflow: 'hidden',
  },
  iconTile: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  noteInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 92,
    textAlignVertical: 'top',
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },

  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    borderRadius: 18,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },

  sectionTitle: { fontSize: 17.5, fontFamily: 'Inter_700Bold' },
  sectionSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 3, lineHeight: 18 },
});
