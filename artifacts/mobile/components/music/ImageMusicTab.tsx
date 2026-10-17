import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { parseApiError, supabaseFetch } from '@/constants/supabase';
import { IMG_MUSIC_GENRES, IMG_MUSIC_MOODS, COSTS, s } from './shared';
import type { MusicCtx } from './shared';
import { UploadOrRecord, ImageUploadArea } from './AudioInputs';
import { ChipSelect, LanguageDropdown, DurationSlider, GenBtn, SL, ErrBox } from './FormControls';
import { ImgMusicResult } from './ImgMusicResult';

export function ImageMusicTab({ ctx }: { ctx: MusicCtx }) {
  const { colors } = useTheme();
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [musicSource, setMusicSource] = useState<'generate' | 'upload'>('generate');
  const [desc, setDesc] = useState('');
  const [genre, setGenre] = useState(IMG_MUSIC_GENRES[0]);
  const [mood, setMood] = useState(IMG_MUSIC_MOODS[0]);
  const [lyrics, setLyrics] = useState('');
  const [duration, setDuration] = useState(30);
  const [language, setLanguage] = useState('English');
  const [uploadedAudioBase64, setUploadedAudioBase64] = useState<string | null>(null);
  const [uploadedAudioName, setUploadedAudioName] = useState<string | null>(null);
  const [gen, setGen] = useState(false);
  const [lyricsGen, setLyricsGen] = useState(false);
  const [result, setResult] = useState<{ audioUrl: string; hasVocals: boolean; imgBase64: string; videoUrl?: string } | null>(null);
  const [err, setErr] = useState('');

  const generateLyrics = async () => {
    setErr(''); setLyricsGen(true);
    try {
      const res = await supabaseFetch('/functions/v1/generate-lyrics', {
        method: 'POST',
        body: JSON.stringify({ description: desc.trim() || 'a beautiful scene', genre, mood, language }),
      }, ctx.session?.access_token);
      if (!res.ok) { setErr(await parseApiError(res)); return; }
      const data = await res.json() as { lyrics?: string };
      if (data.lyrics) setLyrics(data.lyrics);
      else setErr('No lyrics were returned. Please try again.');
    } catch {
      setErr('Could not reach the lyrics service. Check your connection and try again.');
    }
    setLyricsGen(false);
  };

  const generate = async () => {
    if (!imageBase64) { setErr('Please upload an image.'); return; }
    if (musicSource === 'upload' && !uploadedAudioBase64) { setErr('Please upload an audio file.'); return; }
    const estimatedCost = lyrics.trim() ? COSTS.imgVocals : COSTS.imgInstrumental;
    if (ctx.walletBalance < estimatedCost) { setErr(`Insufficient balance. You need ₹${estimatedCost}.`); return; }
    setErr(''); setGen(true); setResult(null);
    try {
      const payload: Record<string, unknown> = {
        imageBase64,
        musicDescription: desc.trim() || undefined,
        lyrics: lyrics.trim() || undefined,
        genre,
        mood,
        durationSeconds: duration,
        language,
        uploadedAudioBase64: musicSource === 'upload' ? uploadedAudioBase64 : null,
      };
      const res = await supabaseFetch('/functions/v1/elevenlabs-image-music-video', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, ctx.session?.access_token);
      const data = await res.json() as { success: boolean; audioUrl?: string; b2Url?: string; videoUrl?: string; imageBase64?: string; hasVocals?: boolean; error?: string };
      if (!data.success || !(data.audioUrl || data.b2Url)) throw new Error(data.error ?? 'Generation failed');
      const audioUrl = data.b2Url || data.audioUrl || '';

      const amountCharged = data.hasVocals ? COSTS.imgVocals : COSTS.imgInstrumental;
      await supabaseFetch('/rest/v1/image_music_generations', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' } as Record<string, string>,
        body: JSON.stringify({
          user_id: ctx.profileId,
          image_url: imageBase64,
          audio_url: audioUrl,
          video_url: data.videoUrl ?? null,
          description: desc.trim(),
          lyrics: lyrics.trim() || null,
          genre, mood,
          duration_seconds: duration,
          has_vocals: data.hasVocals ?? false,
          amount_charged: amountCharged,
          status: 'completed',
          completed_at: new Date().toISOString(),
        }),
      }, ctx.session?.access_token);

      setResult({
        audioUrl,
        hasVocals: data.hasVocals ?? false,
        imgBase64: data.imageBase64 ?? imageBase64,
        videoUrl: data.videoUrl,
      });
      ctx.refreshWallet();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGen(false);
    }
  };

  return (
    <View style={s.tabContent}>
      <SL text="Upload Image" />
      <ImageUploadArea imageUri={imageUri} onImage={(b64, uri) => { setImageBase64(b64); setImageUri(uri); }} onClear={() => { setImageBase64(null); setImageUri(null); }} />
      <SL text="Music Source" />
      <View style={[s.toggleRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        {(['generate', 'upload'] as const).map(opt => (
          <TouchableOpacity key={opt} style={[s.toggleOpt, musicSource === opt && s.toggleOptActive]} onPress={() => setMusicSource(opt)}>
            <Text style={[s.toggleOptText, { color: musicSource === opt ? '#fff' : colors.foreground }]}>
              {opt === 'generate' ? 'AI Generate' : 'Upload Audio'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {musicSource === 'generate' && (
        <>
          <SL text="Music Description" />
          <TextInput style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
            placeholder="Calming piano melody for a sunset beach..." placeholderTextColor={colors.mutedForeground}
            value={desc} onChangeText={setDesc} multiline numberOfLines={3} />
          <SL text="Genre" />
          <ChipSelect options={IMG_MUSIC_GENRES} value={genre} onChange={setGenre} activeColor="#FF5F1F" />
          <SL text="Mood" />
          <ChipSelect options={IMG_MUSIC_MOODS} value={mood} onChange={setMood} activeColor="#B026FF" />
          <LanguageDropdown value={language} onChange={setLanguage} />
          <View style={s.lyricHeader}>
            <SL text="Lyrics (optional)" />
            <TouchableOpacity style={[s.aiLyricsBtn, { borderColor: '#FF5F1F' }]} onPress={generateLyrics} disabled={lyricsGen}>
              <Icon name="zap" size={13} color="#FF5F1F" />
              <Text style={s.aiLyricsBtnText}>{lyricsGen ? 'Generating...' : 'AI Generate'}</Text>
            </TouchableOpacity>
          </View>
          <TextInput style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular', minHeight: 80 }]}
            placeholder="Optional lyrics for AI vocals..." placeholderTextColor={colors.mutedForeground}
            value={lyrics} onChangeText={setLyrics} multiline numberOfLines={5} />
          <SL text={`Duration: ${duration}s`} />
          <DurationSlider value={duration} onChange={setDuration} min={10} max={60} step={5} />
        </>
      )}
      {musicSource === 'upload' && (
        <>
          <SL text="Upload Audio" />
          <UploadOrRecord
            audioFileName={uploadedAudioName}
            onAudio={(b64, name) => { setUploadedAudioBase64(b64); setUploadedAudioName(name); }}
            onClear={() => { setUploadedAudioBase64(null); setUploadedAudioName(null); }}
            showRecorder={false}
          />
        </>
      )}
      <ErrBox msg={err} />
      <GenBtn label={`Create (₹${lyrics.trim() ? COSTS.imgVocals : COSTS.imgInstrumental})`} onPress={generate} generating={gen} disabled={!imageBase64} />
      {result && (
        <ImgMusicResult
          audioUrl={result.audioUrl}
          imgBase64={result.imgBase64}
          hasVocals={result.hasVocals}
          videoUrl={result.videoUrl}
        />
      )}
    </View>
  );
}
