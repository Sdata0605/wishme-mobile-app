import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { useAgentPrefill } from '@/context/AgentStateContext';
import { parseApiError, supabaseFetch } from '@/constants/supabase';
import { GENERATE_SONG_GENRES, GENERATE_SONG_MOODS, COSTS, PROGRESS_MESSAGES, s } from './shared';
import type { MusicCtx } from './shared';
import { WaveformBar, AudioPlayerCard } from './AudioPlayer';
import { ChipSelect, LanguageDropdown, GenBtn, SL, ErrBox } from './FormControls';

export function GenerateSongTab({ ctx }: { ctx: MusicCtx }) {
  const { colors } = useTheme();
  const agentPrefill = useAgentPrefill();
  const [songTitle, setSongTitle] = useState('');
  const [songType, setSongType] = useState<'full' | 'instrumental'>('full');
  const [voiceGender, setVoiceGender] = useState<'Any' | 'Male' | 'Female'>('Any');
  const [language, setLanguage] = useState('English');
  const [lyrics, setLyrics] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState(GENERATE_SONG_GENRES[0]);
  const [mood, setMood] = useState(GENERATE_SONG_MOODS[0]);
  const [gen, setGen] = useState(false);
  const [lyricsGen, setLyricsGen] = useState(false);
  const [err, setErr] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (agentPrefill.songTitle) setSongTitle(agentPrefill.songTitle);
    if (agentPrefill.songDescription) setDescription(agentPrefill.songDescription);
    if (agentPrefill.songGenre) setGenre(agentPrefill.songGenre.toLowerCase());
    if (agentPrefill.songMood) setMood(agentPrefill.songMood.toLowerCase());
    if (agentPrefill.songLanguage) setLanguage(agentPrefill.songLanguage);
  }, [agentPrefill.songTitle, agentPrefill.songDescription, agentPrefill.songGenre, agentPrefill.songMood, agentPrefill.songLanguage]);

  useEffect(() => () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
  }, []);

  const cost = songType === 'full' ? COSTS.fullSong : COSTS.instrumental;

  const generateLyrics = async () => {
    if (!songTitle.trim() && !description.trim()) { setErr('Enter a song title or description first.'); return; }
    setErr(''); setLyricsGen(true);
    try {
      const res = await supabaseFetch('/functions/v1/generate-lyrics', {
        method: 'POST',
        body: JSON.stringify({ description: description.trim() || songTitle.trim(), genre, mood, language }),
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

  const startProgressCycling = () => {
    setProgressMsg(PROGRESS_MESSAGES[0]);
    let idx = 0;
    progressTimerRef.current = setInterval(() => {
      idx = (idx + 1) % PROGRESS_MESSAGES.length;
      setProgressMsg(PROGRESS_MESSAGES[idx]);
    }, 4000);
  };

  const stopProgressCycling = () => {
    if (progressTimerRef.current) { clearInterval(progressTimerRef.current); progressTimerRef.current = null; }
    setProgressMsg('');
  };

  const generate = async () => {
    if (ctx.walletBalance < cost) { setErr(`Insufficient balance. You need ₹${cost}.`); return; }
    setErr(''); setGen(true); setAudioUrl(null);
    startProgressCycling();

    try {
      const payload: Record<string, unknown> = {
        song_title: songTitle.trim() || 'Untitled',
        generation_type: songType === 'full' ? 'with_lyrics' : 'instrumental',
        genre,
        mood,
        prompt: description.trim() || songTitle.trim() || `${genre} ${mood}`,
      };
      if (songType === 'full') {
        payload.voice_type = voiceGender.toLowerCase();
        payload.language = language;
        if (lyrics.trim()) payload.lyrics = lyrics.trim();
      } else {
        if (description.trim()) payload.description = description.trim();
      }

      const res = await supabaseFetch('/functions/v1/generate-music', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, ctx.session?.access_token);

      const data = await res.json() as { generation_id?: string; task_id?: string; status?: string; error?: string };
      if (!res.ok || !data.generation_id) throw new Error(data.error ?? 'Generation failed — no generation ID returned');

      const generationId = data.generation_id;

      await new Promise<void>(resolve => setTimeout(resolve, 10000));

      let attempts = 0;
      const maxAttempts = 60;

      await new Promise<void>((resolve, reject) => {
        pollingRef.current = setInterval(async () => {
          attempts++;
          try {
            const statusRes = await supabaseFetch('/functions/v1/check-music-status', {
              method: 'POST',
              body: JSON.stringify({ generation_id: generationId }),
            }, ctx.session?.access_token);
            const statusData = await statusRes.json() as { status: string; song_url?: string; download_url?: string; error?: string };
            if (statusData.status === 'completed' && (statusData.song_url || statusData.download_url)) {
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              setAudioUrl(statusData.song_url ?? statusData.download_url ?? '');
              ctx.refreshWallet();
              resolve();
            } else if (statusData.status === 'failed') {
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              reject(new Error(statusData.error ?? 'Music generation failed'));
            } else if (attempts >= maxAttempts) {
              if (pollingRef.current) clearInterval(pollingRef.current);
              pollingRef.current = null;
              reject(new Error('Generation timed out. Please try again.'));
            }
          } catch (e) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            pollingRef.current = null;
            reject(e);
          }
        }, 5000);
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      stopProgressCycling();
      setGen(false);
    }
  };

  return (
    <View style={s.tabContent}>
      <SL text="Song Title" />
      <TextInput
        style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
        placeholder="e.g. Birthday Surprise"
        placeholderTextColor={colors.mutedForeground}
        value={songTitle}
        onChangeText={setSongTitle}
      />
      <SL text="Song Type" />
      <View style={[s.toggleRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        {(['full', 'instrumental'] as const).map(opt => (
          <TouchableOpacity key={opt} style={[s.toggleOpt, songType === opt && s.toggleOptActive]} onPress={() => setSongType(opt)}>
            <Text style={[s.toggleOptText, { color: songType === opt ? '#fff' : colors.foreground }]}>
              {opt === 'full' ? 'Full Song' : 'Instrumental'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {songType === 'full' && (
        <>
          <SL text="Voice Gender" />
          <View style={[s.toggleRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            {(['Any', 'Male', 'Female'] as const).map(g => (
              <TouchableOpacity key={g} style={[s.toggleOpt, voiceGender === g && s.toggleOptActive]} onPress={() => setVoiceGender(g)}>
                <Text style={[s.toggleOptText, { color: voiceGender === g ? '#fff' : colors.foreground }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <SL text="Language" />
          <LanguageDropdown value={language} onChange={setLanguage} />
        </>
      )}
      <SL text="Genre" />
      <ChipSelect options={GENERATE_SONG_GENRES} value={genre} onChange={setGenre} activeColor="#B026FF" />
      <SL text="Mood" />
      <ChipSelect options={GENERATE_SONG_MOODS} value={mood} onChange={setMood} activeColor="#FF5F1F" />
      {songType === 'full' ? (
        <>
          <View style={s.lyricHeader}>
            <SL text="Lyrics" />
            <TouchableOpacity style={[s.aiLyricsBtn, { borderColor: '#B026FF' }]} onPress={generateLyrics} disabled={lyricsGen}>
              <Icon name="sparkles" size={13} color="#B026FF" />
              <Text style={[s.aiLyricsBtnText, { color: '#B026FF' }]}>{lyricsGen ? 'Generating...' : 'Generate Lyrics'}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', minHeight: 120 }]}
            placeholder="Enter lyrics or tap Generate Lyrics..."
            placeholderTextColor={colors.mutedForeground}
            value={lyrics}
            onChangeText={setLyrics}
            multiline
            numberOfLines={6}
          />
        </>
      ) : (
        <>
          <SL text="Description" />
          <TextInput
            style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
            placeholder="Describe the instrumental track you want..."
            placeholderTextColor={colors.mutedForeground}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </>
      )}
      <ErrBox msg={err} />
      <GenBtn label={`Generate Song (₹${cost})`} onPress={generate} generating={gen} />

      {gen ? (
        <View style={[s.resultPanel, s.resultPanelLoading, { backgroundColor: colors.card, borderColor: '#B026FF' }]}>
          <View style={s.waveRow}>
            {Array.from({ length: 16 }).map((_, i) => (
              <WaveformBar key={i} delay={i * 60} color="#B026FF" active={true} />
            ))}
          </View>
          <Text style={[s.generatingText, { color: colors.foreground }]}>{progressMsg || 'Starting generation...'}</Text>
          <Text style={[s.generatingHint, { color: colors.mutedForeground }]}>This may take up to 5 minutes</Text>
          <View style={[s.genSpinner, { borderColor: '#B026FF' + '30', borderTopColor: '#B026FF' }]} />
        </View>
      ) : audioUrl ? (
        <View style={[s.resultPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <AudioPlayerCard title={songTitle || `${genre} ${songType === 'full' ? 'Song' : 'Instrumental'}`} audioUri={audioUrl} badge={songType === 'full' ? 'Full Song' : 'Instrumental'} />
        </View>
      ) : (
        <View style={[s.resultPanel, s.resultPanelEmpty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <LinearGradient colors={['#B026FF20', '#B026FF20']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.resultEmptyGradient}>
            <Icon name="music" size={32} color="#B026FF" />
            <Text style={[s.resultEmptyTitle, { color: colors.foreground }]}>Your song will appear here</Text>
            <Text style={[s.resultEmptyHint, { color: colors.mutedForeground }]}>Fill in the details above and tap Generate Song</Text>
            <View style={s.decorativeWaveRow}>
              {Array.from({ length: 20 }).map((_, i) => (
                <WaveformBar key={i} delay={i * 50} color={'#B026FF'} active={false} />
              ))}
            </View>
            <View style={s.resultControls}>
              <View style={[s.resultControlBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Icon name="play" size={14} color={colors.mutedForeground} />
              </View>
              <View style={[s.resultControlBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Icon name="download" size={14} color={colors.mutedForeground} />
              </View>
            </View>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}
