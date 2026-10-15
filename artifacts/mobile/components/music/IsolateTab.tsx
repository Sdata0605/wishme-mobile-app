import React, { useState } from 'react';
import { View } from 'react-native';
import { supabaseFetch } from '@/constants/supabase';
import { COSTS, s } from './shared';
import type { MusicCtx } from './shared';
import { AudioPlayerCard } from './AudioPlayer';
import { UploadOrRecord } from './AudioInputs';
import { GenBtn, SL, ErrBox, InfoBox } from './FormControls';

export function IsolateTab({ ctx }: { ctx: MusicCtx }) {
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [gen, setGen] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const handleAudio = (base64: string, name: string) => { setAudioBase64(base64); setAudioFileName(name); };

  const generate = async () => {
    if (!audioBase64) { setErr('Please upload an audio file.'); return; }
    if (ctx.walletBalance < COSTS.audioIsolation) { setErr(`Insufficient balance. You need ₹${COSTS.audioIsolation}.`); return; }
    setErr(''); setGen(true); setAudioUri(null);
    try {
      const res = await supabaseFetch('/functions/v1/elevenlabs-audio-isolation', {
        method: 'POST',
        body: JSON.stringify({ audioBase64 }),
      }, ctx.session?.access_token);
      const data = await res.json() as { success: boolean; audioUrl: string; error?: string };
      if (!data.success || !data.audioUrl) throw new Error(data.error ?? 'Isolation failed');
      await supabaseFetch('/rest/v1/audio_isolation_generations', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' } as Record<string, string>,
        body: JSON.stringify({ user_id: ctx.profileId, original_file_name: audioFileName ?? 'audio.wav', audio_url: data.audioUrl, status: 'completed', credits_used: COSTS.audioIsolation }),
      }, ctx.session?.access_token);
      setAudioUri(data.audioUrl);
      ctx.refreshWallet();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Isolation failed');
    } finally {
      setGen(false);
    }
  };

  return (
    <View style={s.tabContent}>
      <InfoBox msg="AI will remove background noise and isolate the main audio from your file." />
      <SL text="Upload Audio File" />
      <UploadOrRecord audioFileName={audioFileName} onAudio={handleAudio} onClear={() => { setAudioBase64(null); setAudioFileName(null); }} showRecorder={false} />
      <ErrBox msg={err} />
      <GenBtn label={`Isolate Audio (₹${COSTS.audioIsolation})`} onPress={generate} generating={gen} disabled={!audioBase64} />
      {audioUri && <AudioPlayerCard title="Isolated Audio" audioUri={audioUri} />}
    </View>
  );
}
