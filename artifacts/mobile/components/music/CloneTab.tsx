import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { supabaseFetch } from '@/constants/supabase';
import { COSTS, s } from './shared';
import type { MusicCtx } from './shared';
import { UploadOrRecord } from './AudioInputs';
import { GenBtn, SL, ErrBox, InfoBox } from './FormControls';

export function CloneTab({ ctx }: { ctx: MusicCtx }) {
  const { colors } = useTheme();
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState('');
  const [voiceDesc, setVoiceDesc] = useState('');
  const [gen, setGen] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const handleAudio = (base64: string, name: string) => { setAudioBase64(base64); setAudioFileName(name); };

  const generate = async () => {
    if (!audioBase64) { setErr('Please upload or record a voice sample.'); return; }
    if (!voiceName.trim()) { setErr('Please enter a voice name.'); return; }
    if (ctx.walletBalance < COSTS.voiceClone) { setErr(`Insufficient balance. You need ₹${COSTS.voiceClone}.`); return; }
    setErr(''); setGen(true); setDone(false);
    try {
      const res = await supabaseFetch('/functions/v1/elevenlabs-clone-voice', {
        method: 'POST',
        body: JSON.stringify({ audioBase64, voiceName: voiceName.trim(), voiceDescription: voiceDesc.trim() }),
      }, ctx.session?.access_token);
      const data = await res.json() as { success: boolean; voiceId?: string; error?: string };
      if (!data.success) throw new Error(data.error ?? 'Cloning failed');
      setDone(true);
      ctx.onVoiceCloned();
      ctx.refreshWallet();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Cloning failed');
    } finally {
      setGen(false);
    }
  };

  return (
    <View style={s.tabContent}>
      <InfoBox msg="For best results, record 1–5 minutes of clear, natural speech." color="#B026FF" />
      <SL text="Upload or Record Voice Sample" />
      <UploadOrRecord audioFileName={audioFileName} onAudio={handleAudio} onClear={() => { setAudioBase64(null); setAudioFileName(null); }} />
      <SL text="Voice Name" />
      <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
        placeholder="My Custom Voice" placeholderTextColor={colors.mutedForeground} value={voiceName} onChangeText={setVoiceName} />
      <SL text="Description (optional)" />
      <TextInput style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
        placeholder="e.g. Deep male voice with a slight accent..." placeholderTextColor={colors.mutedForeground}
        value={voiceDesc} onChangeText={setVoiceDesc} multiline numberOfLines={3} />
      <ErrBox msg={err} />
      <GenBtn label={`Clone Voice (₹${COSTS.voiceClone})`} onPress={generate} generating={gen} disabled={!audioBase64} />
      {done && (
        <View style={[s.successCard, { backgroundColor: '#22c55e15', borderColor: '#22c55e40' }]}>
          <View style={s.successIcon}><Icon name="check-circle" size={28} color="#22c55e" /></View>
          <Text style={[s.successTitle, { color: '#22c55e' }]}>Voice Cloned!</Text>
          <Text style={[s.successSub, { color: '#22c55e99' }]}>"{voiceName}" is ready to use in TTS, Voice Conversion, and Generate Song tabs.</Text>
        </View>
      )}
    </View>
  );
}
