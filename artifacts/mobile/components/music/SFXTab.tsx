import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAgentPrefill } from '@/context/AgentStateContext';
import { supabaseFetch } from '@/constants/supabase';
import { COSTS, s } from './shared';
import type { MusicCtx } from './shared';
import { AudioPlayerCard } from './AudioPlayer';
import { DurationSlider, GenBtn, SL, ErrBox } from './FormControls';

export function SFXTab({ ctx }: { ctx: MusicCtx }) {
  const { colors } = useTheme();
  const agentPrefill = useAgentPrefill();
  const [desc, setDesc] = useState('');
  const [duration, setDuration] = useState(5);
  const [gen, setGen] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (agentPrefill.sfxPrompt) setDesc(agentPrefill.sfxPrompt);
  }, [agentPrefill.sfxPrompt]);

  const generate = async () => {
    if (!desc.trim()) { setErr('Please describe the sound effect.'); return; }
    if (ctx.walletBalance < COSTS.sfx) { setErr(`Insufficient balance. You need ₹${COSTS.sfx}.`); return; }
    setErr(''); setGen(true); setAudioUri(null);
    try {
      const res = await supabaseFetch('/functions/v1/elevenlabs-sound-effects', {
        method: 'POST',
        body: JSON.stringify({ text: desc.trim(), durationSeconds: duration }),
      }, ctx.session?.access_token);
      const data = await res.json() as { success: boolean; audioUrl: string; error?: string };
      if (!data.success || !data.audioUrl) throw new Error(data.error ?? 'Generation failed');
      await supabaseFetch('/rest/v1/sound_effect_generations', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' } as Record<string, string>,
        body: JSON.stringify({ user_id: ctx.profileId, description: desc.slice(0, 500), duration_seconds: duration, audio_url: data.audioUrl, status: 'completed', credits_used: COSTS.sfx }),
      }, ctx.session?.access_token);
      setAudioUri(data.audioUrl);
      ctx.refreshWallet();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGen(false);
    }
  };

  return (
    <View style={s.tabContent}>
      <SL text="Describe the Sound Effect" />
      <TextInput style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
        placeholder="Thunder, rain, birds chirping..." placeholderTextColor={colors.mutedForeground}
        value={desc} onChangeText={setDesc} multiline numberOfLines={4} />
      <SL text={`Duration: ${duration}s`} />
      <DurationSlider value={duration} onChange={setDuration} min={1} max={22} />
      <ErrBox msg={err} />
      <GenBtn label={`Generate SFX (₹${COSTS.sfx})`} onPress={generate} generating={gen} />
      {audioUri && <AudioPlayerCard title="Sound Effect" audioUri={audioUri} />}
    </View>
  );
}
