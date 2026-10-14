import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GradientButton } from '@/components/GradientButton';
import { Icon } from '@/components/Icon';
import {
  LanguagePicker,
  NameField,
  PersonalityPicker,
  SectionLabel,
  VoiceList,
} from '@/components/assistant/PersonaForm';
import { cleanName, useAssistantPersona } from '@/context/AssistantPersonaContext';
import { useTheme } from '@/context/ThemeContext';
import { DEFAULT_PERSONA, type AssistantPersona } from '@/services/assistant/persona';

type Draft = Omit<AssistantPersona, 'isDefault'>;

const toDraft = (p: AssistantPersona): Draft => ({
  name: p.name,
  voice: p.voice,
  personality: p.personality,
  customNote: p.customNote,
  language: p.language,
});

/** The "AI Assistant" tab in Settings: voice (with audio samples), name, personality and language. */
export function AssistantSettingsPanel() {
  const { colors } = useTheme();
  const { persona, status, save } = useAssistantPersona();

  const [draft, setDraft] = useState<Draft>(() => toDraft(persona));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pick up the saved persona once it has loaded, but never overwrite edits in progress.
  const savedJson = useMemo(() => JSON.stringify(toDraft(persona)), [persona]);
  const edited = useRef(false);
  const dirty = JSON.stringify(draft) !== savedJson;
  useEffect(() => {
    if (!edited.current) setDraft(toDraft(persona));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedJson]);

  const update = (patch: Partial<Draft>) => {
    edited.current = true;
    setSaved(false);
    setError(null);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    const err = await save({ ...draft, name: cleanName(draft.name) || DEFAULT_PERSONA.name });
    setSaving(false);
    if (err) setError(err);
    else {
      edited.current = false;
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const canSave = (dirty || status === 'needs-setup') && !saving && draft.name.trim().length > 0;

  return (
    <View>
      {status === 'needs-setup' ? (
        <Pressable
          onPress={() => router.push('/assistant-setup')}
          accessibilityRole="button"
          accessibilityLabel="Start the guided assistant setup"
          style={({ pressed }) => [
            s.banner,
            { backgroundColor: colors.primary + '18', borderColor: colors.primary + '55', opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Icon name="sparkles" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[s.bannerText, { color: colors.foreground }]}>
              You haven't set up your assistant yet. Take the guided tour, or change anything below and save.
            </Text>
            <Text style={[s.bannerLink, { color: colors.primary }]}>Start the guided setup</Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.primary} />
        </Pressable>
      ) : null}

      <SectionLabel title="Voice" subtitle="Listen to each voice, then choose the one you like." />
      <VoiceList value={draft.voice} onChange={(voice) => update({ voice })} />

      <SectionLabel title="Name" subtitle="What should your assistant be called?" />
      <NameField value={draft.name} onChange={(name) => update({ name })} />

      <SectionLabel title="Personality" subtitle="How should it talk to you?" />
      <PersonalityPicker
        personality={draft.personality}
        customNote={draft.customNote}
        onPersonality={(personality) => update({ personality })}
        onNote={(customNote) => update({ customNote })}
      />

      <SectionLabel title="Language" subtitle="Which language should it speak?" />
      <LanguagePicker value={draft.language} onChange={(language) => update({ language })} />

      {error ? (
        <View style={[s.errorBox, { backgroundColor: colors.destructive + '1A', borderColor: colors.destructive + '55' }]}>
          <Icon name="alert-circle" size={17} color={colors.destructive} />
          <Text style={[s.error, { color: colors.foreground }]}>{error}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: 26, opacity: canSave || saved ? 1 : 0.5 }}>
        <GradientButton
          title={saving ? 'Saving…' : saved ? 'Saved!' : 'Save assistant'}
          onPress={onSave}
          disabled={!canSave}
          loading={saving}
          height={54}
          icon={saved ? <Icon name="check-circle" size={20} color="#fff" /> : undefined}
          textStyle={s.saveText}
        />
      </View>

      <Pressable
        onPress={() => update(toDraft(DEFAULT_PERSONA))}
        accessibilityRole="button"
        accessibilityLabel="Reset to the default assistant"
        style={({ pressed }) => [s.resetBtn, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={[s.reset, { color: colors.mutedForeground }]}>Reset to the default assistant</Text>
      </Pressable>
      <Text style={[s.footnote, { color: colors.mutedForeground }]}>
        Changes apply the next time you talk to the assistant.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    minHeight: 64,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  bannerText: { fontSize: 13.5, lineHeight: 19, fontFamily: 'Inter_400Regular' },
  bannerLink: { fontSize: 13.5, fontFamily: 'Inter_700Bold', marginTop: 6 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  error: { flex: 1, fontSize: 13.5, lineHeight: 19, fontFamily: 'Inter_500Medium' },
  saveText: { fontSize: 16.5, fontFamily: 'Inter_700Bold' },
  resetBtn: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, marginTop: 8 },
  reset: { fontSize: 14, fontFamily: 'Inter_500Medium', textDecorationLine: 'underline' },
  footnote: { textAlign: 'center', fontSize: 12.5, fontFamily: 'Inter_400Regular', marginTop: 6 },
});
