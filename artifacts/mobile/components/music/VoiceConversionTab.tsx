import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { supabaseFetch } from '@/constants/supabase';
import { type VoiceItem } from '@/hooks/useVoices';
import { COSTS, s } from './shared';
import type { MusicCtx } from './shared';
import { AudioPlayerCard } from './AudioPlayer';
import { UploadOrRecord } from './AudioInputs';
import { VoiceSelect, GenBtn, SL, ErrBox } from './FormControls';

export function VoiceConversionTab({ ctx }: { ctx: MusicCtx }) {
  const { colors } = useTheme();
  const [targetVoice, setTargetVoice] = useState<VoiceItem | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [gen, setGen] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const all = [...ctx.voices.clonedVoices, ...ctx.voices.premadeVoices];
    if (all.length && !targetVoice) setTargetVoice(all[0]);
  }, [ctx.voices]);

  const handleAudio = (base64: string, name: string) => {
    setAudioBase64(base64);
    setAudioFileName(name);
    setAudioUri(null);
  };

  const generate = async () => {
    if (!audioBase64) { setErr('Please record or upload audio.'); return; }
    if (!targetVoice) { setErr('Please select a target voice.'); return; }
    if (ctx.walletBalance < COSTS.voiceConversion) { setErr(`Insufficient balance. You need ₹${COSTS.voiceConversion}.`); return; }
    setErr(''); setGen(true); setAudioUri(null);
    try {
      const res = await supabaseFetch('/functions/v1/elevenlabs-speech-to-speech', {
        method: 'POST',
        body: JSON.stringify({ audioBase64, voiceId: targetVoice.voice_id }),
      }, ctx.session?.access_token);
      const data = await res.json() as { success: boolean; audioUrl: string; error?: string };
      if (!data.success || !data.audioUrl) throw new Error(data.error ?? 'Generation failed');
      await supabaseFetch('/rest/v1/voice_conversion_generations', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' } as Record<string, string>,
        body: JSON.stringify({ user_id: ctx.profileId, target_voice_id: targetVoice.voice_id, target_voice_name: targetVoice.name, audio_url: data.audioUrl, status: 'completed', credits_used: COSTS.voiceConversion }),
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
      <SL text="Select Target Voice" />
      <VoiceSelect value={targetVoice} onChange={setTargetVoice} voices={ctx.voices} voicesLoading={ctx.voicesLoading} />
      <SL text="Your Source Audio" />
      <UploadOrRecord audioFileName={audioFileName} onAudio={handleAudio} onClear={() => { setAudioBase64(null); setAudioFileName(null); }} />
      <ErrBox msg={err} />
      <GenBtn label={`Convert Voice (₹${COSTS.voiceConversion})`} onPress={generate} generating={gen} disabled={!audioBase64} />
      {audioUri && <AudioPlayerCard title="Voice-Converted Audio" audioUri={audioUri} />}
    </View>
  );
}
