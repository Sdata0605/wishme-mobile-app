import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAgentPrefill } from '@/context/AgentStateContext';
import { supabaseFetch } from '@/constants/supabase';
import { type VoiceItem } from '@/hooks/useVoices';
import { COSTS, s } from './shared';
import type { MusicCtx } from './shared';
import { AudioPlayerCard } from './AudioPlayer';
import { VoiceSelect, GenBtn, SL, ErrBox } from './FormControls';

export function TTSTab({ ctx }: { ctx: MusicCtx }) {
  const { colors } = useTheme();
  const agentPrefill = useAgentPrefill();
  const [voice, setVoice] = useState<VoiceItem | null>(null);
  const [text, setText] = useState('');
  const [gen, setGen] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (agentPrefill.ttsText) setText(agentPrefill.ttsText);
  }, [agentPrefill.ttsText]);

  useEffect(() => {
    const all = [...ctx.voices.clonedVoices, ...ctx.voices.premadeVoices];
    if (all.length && !voice) setVoice(all[0]);
  }, [ctx.voices]);

  const generate = async () => {
    if (!text.trim()) { setErr('Please enter some text.'); return; }
    if (!voice) { setErr('Please select a voice.'); return; }
    if (ctx.walletBalance < COSTS.tts) { setErr(`Insufficient balance. You need ₹${COSTS.tts}.`); return; }
    setErr(''); setGen(true); setAudioUri(null);
    try {
      const res = await supabaseFetch('/functions/v1/elevenlabs-text-to-speech', {
        method: 'POST',
        body: JSON.stringify({ text, voiceId: voice.voice_id }),
      }, ctx.session?.access_token);
      const data = await res.json() as { success: boolean; audioUrl: string; error?: string };
      if (!data.success || !data.audioUrl) throw new Error(data.error ?? 'Generation failed');
      await supabaseFetch('/rest/v1/tts_generations', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' } as Record<string, string>,
        body: JSON.stringify({ user_id: ctx.profileId, text: text.slice(0, 500), voice_id: voice.voice_id, voice_name: voice.name, audio_url: data.audioUrl, status: 'completed', credits_used: COSTS.tts }),
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
      <SL text="Select Voice" />
      <VoiceSelect value={voice} onChange={setVoice} voices={ctx.voices} voicesLoading={ctx.voicesLoading} />
      <SL text="Enter Text" />
      <TextInput style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
        placeholder="Type the text you want converted to speech..." placeholderTextColor={colors.mutedForeground}
        value={text} onChangeText={setText} multiline numberOfLines={5} />
      <ErrBox msg={err} />
      <GenBtn label={`Generate Speech (₹${COSTS.tts})`} onPress={generate} generating={gen} />
      {audioUri && <AudioPlayerCard title="Generated Speech" audioUri={audioUri} />}
    </View>
  );
}
