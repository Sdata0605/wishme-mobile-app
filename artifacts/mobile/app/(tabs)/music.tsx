import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabaseFetch } from '@/constants/supabase';
import { type VoiceItem, type VoiceList, useVoices } from '@/hooks/useVoices';
import { useWallet } from '@/hooks/useWallet';

interface MusicCtx {
  voices: VoiceList;
  voicesLoading: boolean;
  walletBalance: number;
  refreshWallet: () => void;
  session: { access_token: string } | null;
  profileId: string;
  onVoiceCloned: () => void;
}

interface MusicResult {
  twoTrack: boolean;
  audioUrl?: string;
  instrumentalUrl?: string;
  vocalsUrl?: string;
}

const MUSIC_TABS = [
  { label: 'Generate Song', icon: 'sparkles' },
  { label: 'TTS', icon: 'volume-2' },
  { label: 'Voice Conversion', icon: 'mic' },
  { label: 'SFX', icon: 'zap' },
  { label: 'Clone', icon: 'user-plus' },
  { label: 'Isolate', icon: 'file-audio' },
  { label: 'Img+Music', icon: 'image' },
];

const GENERATE_SONG_GENRES = ['bollywood', 'pop', 'romantic', 'happy', 'lofi', 'classical', 'hip-hop', 'r&b', 'edm', 'folk'];
const GENERATE_SONG_MOODS = ['happy', 'sad', 'energetic', 'calm', 'romantic', 'epic', 'melancholic', 'uplifting'];
const SONG_LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Punjabi', 'Bengali'];
const IMG_MUSIC_GENRES = ['ambient', 'pop', 'classical', 'electronic', 'rock', 'r&b'];
const IMG_MUSIC_MOODS = ['calm', 'happy', 'romantic', 'epic', 'sad', 'energetic'];

const COSTS = {
  tts: 50,
  voiceConversion: 75,
  sfx: 60,
  audioIsolation: 40,
  instrumental: 100,
  fullSong: 150,
  voiceClone: 150,
  imgInstrumental: 120,
  imgVocals: 150,
};

const PROGRESS_MESSAGES = [
  'Composing your melody...',
  'Arranging instruments...',
  'Adding rhythm and beat...',
  'Mixing tracks...',
  'Applying AI magic...',
  'Polishing the sound...',
  'Almost there...',
  'Finalizing your song...',
];

async function saveAudioToCache(dataUri: string): Promise<string> {
  const isMP3 = dataUri.startsWith('data:audio/mpeg');
  const ext = isMP3 ? 'mp3' : 'wav';
  const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
  const path = (FileSystem.cacheDirectory ?? '') + `wishme_${Date.now()}.${ext}`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
  return path;
}

async function downloadToDevice(dataUri: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const mimeMatch = dataUri.match(/^data:([^;]+);base64,/);
    const mime = mimeMatch?.[1] ?? 'application/octet-stream';
    const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('media_library_permission_denied');
  }

  if (dataUri.startsWith('file://')) {
    await MediaLibrary.saveToLibraryAsync(dataUri);
    return;
  }

  if (dataUri.startsWith('http://') || dataUri.startsWith('https://')) {
    const tempPath = (FileSystem.cacheDirectory ?? '') + filename;
    await FileSystem.downloadAsync(dataUri, tempPath);
    await MediaLibrary.saveToLibraryAsync(tempPath);
    return;
  }

  const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
  const tempPath = (FileSystem.cacheDirectory ?? '') + filename;
  await FileSystem.writeAsStringAsync(tempPath, base64, { encoding: FileSystem.EncodingType.Base64 });
  await MediaLibrary.saveToLibraryAsync(tempPath);
}

async function downloadUrlToDevice(url: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('media_library_permission_denied');
  }

  const tempPath = (FileSystem.cacheDirectory ?? '') + filename;
  await FileSystem.downloadAsync(url, tempPath);
  await MediaLibrary.saveToLibraryAsync(tempPath);
}

async function fileUriToBase64(uri: string, mimeType = 'audio/wav'): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return `data:${mimeType};base64,${base64}`;
}

function fmtMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}

function WaveformBar({ delay, color = '#FF6B33', active = true }: { delay: number; color?: string; active?: boolean }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!active) { anim.setValue(0.3); loopRef.current?.stop(); loopRef.current = null; return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 300 + delay, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.3, duration: 300 + delay, useNativeDriver: true }),
    ]));
    loopRef.current = loop;
    const t = setTimeout(() => loop.start(), delay);
    return () => { clearTimeout(t); loop.stop(); };
  }, [active]);

  return <Animated.View style={{ width: 4, height: 28, backgroundColor: color, borderRadius: 2, transform: [{ scaleY: anim }] }} />;
}

function AudioPlayerCard({ title, audioUri, badge }: { title: string; audioUri: string; badge?: string }) {
  const { colors } = useTheme();
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [saved, setSaved] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => { soundRef.current?.unloadAsync().catch(() => {}); };
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
      const isRemoteUrl = audioUri.startsWith('http://') || audioUri.startsWith('https://');
      const uri = isRemoteUrl ? audioUri : await saveAudioToCache(audioUri);
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      sound.setOnPlaybackStatusUpdate(s => {
        if (!s.isLoaded) return;
        setPosition(s.positionMillis);
        if (s.durationMillis) setDuration(s.durationMillis);
        if (s.didJustFinish) { setPlaying(false); setPosition(0); }
      });
      soundRef.current = sound;
      setPlaying(true);
    } catch {
      setPlaying(false);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    if (loading) return;
    if (!soundRef.current) { await load(); return; }
    if (playing) { await soundRef.current.pauseAsync(); setPlaying(false); }
    else { await soundRef.current.playAsync(); setPlaying(true); }
  };

  const stop = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setPlaying(false);
    setPosition(0);
  };

  const saveAudio = async () => {
    try {
      const isMP3 = audioUri.startsWith('data:audio/mpeg') || audioUri.endsWith('.mp3');
      const ext = isMP3 ? 'mp3' : audioUri.startsWith('data:audio/mp4') || audioUri.startsWith('data:audio/m4a') ? 'm4a' : 'wav';
      if (audioUri.startsWith('http://') || audioUri.startsWith('https://')) {
        await downloadUrlToDevice(audioUri, `wishme_audio_${Date.now()}.${ext}`);
      } else {
        await downloadToDevice(audioUri, `wishme_audio_${Date.now()}.${ext}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      const msg = err instanceof Error && err.message === 'media_library_permission_denied'
        ? 'Please allow media library access to save audio to your device.'
        : 'Could not save the audio. Please try again.';
      Alert.alert('Save Failed', msg);
    }
  };

  const durationLabel = duration > 0 ? fmtMs(duration) : '--:--';
  const positionLabel = position > 0 ? fmtMs(position) : '0:00';

  return (
    <View style={[s.playerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.playerGradient}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Text style={s.playerTitle}>{title}</Text>
          {badge ? <View style={s.badgePill}><Text style={s.badgeText}>{badge}</Text></View> : null}
        </View>
        <View style={s.waveRow}>
          {Array.from({ length: 18 }).map((_, i) => (
            <WaveformBar key={i} delay={i * 60} color={playing ? '#fff' : 'rgba(255,255,255,0.5)'} active={playing} />
          ))}
        </View>
        <View style={s.playerControls}>
          <TouchableOpacity style={s.playBtn} onPress={toggle} disabled={loading}>
            <Icon name={loading ? 'refresh-cw' : playing ? 'pause' : 'play'} size={20} color="#fff" />
          </TouchableOpacity>
          {(playing || position > 0) ? (
            <TouchableOpacity style={[s.playBtn, { marginLeft: 6 }]} onPress={stop}>
              <Icon name="volume-x" size={16} color="#fff" />
            </TouchableOpacity>
          ) : null}
          <Text style={[s.playerDuration, { flex: 1 }]}>{positionLabel} / {durationLabel}</Text>
          <TouchableOpacity style={s.dlBtn} onPress={saveAudio}>
            <Icon name={saved ? 'check' : 'download'} size={15} color="#fff" />
            <Text style={s.dlText}>{saved ? 'Saved!' : 'Download MP3'}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

type RecorderState = 'idle' | 'recording' | 'preview';

function AudioRecorder({ onAudio, label = 'Record Audio' }: { onAudio: (base64: string, name: string) => void; label?: string }) {
  const { colors } = useTheme();
  const [state, setState] = useState<RecorderState>('idle');
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const startPulse = useCallback(() => {
    pulseAnim.setValue(1);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    pulseRef.current = loop;
    loop.start();
  }, [pulseAnim]);

  const stopPulse = () => { pulseRef.current?.stop(); pulseRef.current = null; };
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  useEffect(() => () => {
    stopTimer();
    stopPulse();
    recordingRef.current?.stopAndUnloadAsync().catch(() => {});
  }, []);

  const startRecord = async () => {
    setError('');
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { setError('Microphone permission denied'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setState('recording');
      setSecs(0);
      startPulse();
      timerRef.current = setInterval(() => setSecs(s => s + 1), 1000);
    } catch {
      setError('Could not start recording');
    }
  };

  const stopRecord = async () => {
    stopTimer();
    stopPulse();
    const rec = recordingRef.current;
    if (!rec) { setState('idle'); return; }
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;
      if (uri) {
        const ext = uri.split('.').pop()?.toLowerCase() ?? 'wav';
        const mime = ext === 'm4a' ? 'audio/m4a' : ext === 'caf' ? 'audio/x-caf' : ext === '3gp' ? 'audio/3gp' : 'audio/wav';
        const base64 = await fileUriToBase64(uri, mime);
        onAudio(base64, `recording.${ext}`);
        setState('preview');
      } else {
        setState('idle');
      }
    } catch {
      setState('idle');
    }
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (state === 'preview') {
    return (
      <View style={[s.recorderPreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.waveRow}>
          {Array.from({ length: 12 }).map((_, i) => <WaveformBar key={i} delay={i * 80} color="#B44CFF" active={false} />)}
        </View>
        <Text style={[s.recDuration, { color: colors.mutedForeground }]}>{fmtTime(secs)}</Text>
        <TouchableOpacity style={[s.reRecordBtn, { borderColor: colors.border }]} onPress={() => { setState('idle'); setSecs(0); }}>
          <Icon name="mic" size={14} color={colors.mutedForeground} />
          <Text style={[s.reRecordText, { color: colors.mutedForeground }]}>Re-record</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity
        style={[s.recorderBtn, { backgroundColor: state === 'recording' ? '#FF6B3315' : colors.card, borderColor: state === 'recording' ? '#FF6B33' : colors.border }]}
        onPress={state === 'idle' ? startRecord : stopRecord}
        activeOpacity={0.8}
      >
        {state === 'recording' ? (
          <View style={s.recRow}>
            <Animated.View style={[s.recDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={[s.recLabel, { color: '#FF6B33' }]}>Recording... {fmtTime(secs)}</Text>
            <Text style={[s.recHint, { color: colors.mutedForeground }]}>Tap to stop</Text>
          </View>
        ) : (
          <View style={s.recRow}>
            <Icon name="mic" size={20} color="#B44CFF" />
            <Text style={[s.recLabel, { color: colors.foreground }]}>{label}</Text>
          </View>
        )}
      </TouchableOpacity>
      {!!error && <Text style={s.errorText}>{error}</Text>}
    </View>
  );
}

function UploadOrRecord({ audioFileName, onAudio, onClear, showRecorder = true }: {
  audioFileName: string | null;
  onAudio: (base64: string, name: string) => void;
  onClear: () => void;
  showRecorder?: boolean;
}) {
  const { colors } = useTheme();

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? 'audio/wav';
      const base64 = await fileUriToBase64(asset.uri, mimeType);
      onAudio(base64, asset.name ?? 'audio.wav');
    } catch {}
  };

  if (audioFileName) {
    return (
      <View style={[s.recorderPreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Icon name="music" size={18} color="#B44CFF" />
        <Text style={[s.uploadText, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>{audioFileName}</Text>
        <TouchableOpacity onPress={onClear}>
          <Icon name="x" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.uploadOrRec}>
      <TouchableOpacity style={[s.uploadBtn, { borderColor: colors.border, backgroundColor: colors.card }]} activeOpacity={0.8} onPress={pickFile}>
        <Icon name="upload" size={18} color="#B44CFF" />
        <Text style={[s.uploadText, { color: colors.foreground }]}>Upload Audio File</Text>
      </TouchableOpacity>
      {showRecorder && (
        <>
          <View style={s.orDivider}>
            <View style={[s.divLine, { backgroundColor: colors.border }]} />
            <Text style={[s.orText, { color: colors.mutedForeground }]}>or</Text>
            <View style={[s.divLine, { backgroundColor: colors.border }]} />
          </View>
          <AudioRecorder onAudio={onAudio} />
        </>
      )}
    </View>
  );
}

function ImageUploadArea({ imageUri, onImage, onClear }: { imageUri: string | null; onImage: (base64: string, displayUri: string) => void; onClear: () => void }) {
  const { colors } = useTheme();

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const b64 = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : '';
    if (b64) onImage(b64, asset.uri);
  };

  if (imageUri) {
    return (
      <View style={[s.imagePreview, { borderColor: '#B44CFF' }]}>
        <Image source={{ uri: imageUri }} style={{ width: '100%', height: 160, borderRadius: 12 }} resizeMode="cover" />
        <TouchableOpacity style={s.changeImageBtn} onPress={onClear}>
          <Text style={s.changeImageText}>Change Image</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={[s.imageUploadArea, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={pick} activeOpacity={0.8}>
      <Icon name="upload" size={28} color="#B44CFF" />
      <Text style={[s.imageUploadText, { color: colors.foreground }]}>Tap to Upload Image</Text>
      <Text style={[{ fontSize: 12, fontFamily: 'Inter_400Regular' }, { color: colors.mutedForeground }]}>JPG, PNG up to 10MB</Text>
    </TouchableOpacity>
  );
}

function VoiceSelect({ value, onChange, voices, voicesLoading }: {
  value: VoiceItem | null;
  onChange: (v: VoiceItem) => void;
  voices: VoiceList;
  voicesLoading: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const previewSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => () => { previewSoundRef.current?.unloadAsync().catch(() => {}); }, []);

  const playPreview = async (voice: VoiceItem) => {
    if (!voice.preview_url) return;
    if (previewSoundRef.current) {
      await previewSoundRef.current.stopAsync().catch(() => {});
      await previewSoundRef.current.unloadAsync().catch(() => {});
      previewSoundRef.current = null;
      if (playingId === voice.voice_id) { setPlayingId(null); return; }
    }
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
      const { sound } = await Audio.Sound.createAsync({ uri: voice.preview_url }, { shouldPlay: true });
      previewSoundRef.current = sound;
      setPlayingId(voice.voice_id);
      sound.setOnPlaybackStatusUpdate(s => {
        if (s.isLoaded && s.didJustFinish) { setPlayingId(null); previewSoundRef.current = null; }
      });
    } catch {}
  };

  const allVoices = [...voices.clonedVoices, ...voices.premadeVoices];
  const displayName = value?.name ?? (voicesLoading ? 'Loading voices...' : allVoices.length === 0 ? 'No voices available' : 'Select a voice');

  const renderVoiceItem = (v: VoiceItem) => (
    <TouchableOpacity
      key={v.voice_id}
      style={[s.dropdownItem, value?.voice_id === v.voice_id && { backgroundColor: '#B44CFF20' }]}
      onPress={() => { onChange(v); setOpen(false); }}
    >
      <Text style={[s.dropdownItemText, { color: value?.voice_id === v.voice_id ? '#B44CFF' : colors.foreground, flex: 1 }]} numberOfLines={1}>{v.name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {v.preview_url ? (
          <TouchableOpacity onPress={() => playPreview(v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name={playingId === v.voice_id ? 'pause' : 'play'} size={14} color="#B44CFF" />
          </TouchableOpacity>
        ) : null}
        {value?.voice_id === v.voice_id && <Icon name="check" size={14} color="#B44CFF" />}
      </View>
    </TouchableOpacity>
  );

  return (
    <View>
      <TouchableOpacity style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setOpen(o => !o)}>
        <Text style={[s.dropdownText, { color: value ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>{displayName}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      {open && (
        <View style={[s.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {voices.clonedVoices.length > 0 && (
            <>
              <View style={[s.voiceGroupHeader, { borderBottomColor: colors.border }]}>
                <Text style={[s.voiceGroupLabel, { color: '#B44CFF' }]}>Your Cloned Voices</Text>
              </View>
              {voices.clonedVoices.map(renderVoiceItem)}
              <View style={[s.voiceGroupDivider, { backgroundColor: colors.border }]} />
            </>
          )}
          {voices.premadeVoices.length > 0 && (
            <>
              <View style={[s.voiceGroupHeader, { borderBottomColor: colors.border }]}>
                <Text style={[s.voiceGroupLabel, { color: colors.mutedForeground }]}>Premade Voices</Text>
              </View>
              {voices.premadeVoices.map(renderVoiceItem)}
            </>
          )}
          {allVoices.length === 0 && (
            <Text style={[s.dropdownItemText, { color: colors.mutedForeground, padding: 14 }]}>
              {voicesLoading ? 'Loading...' : 'No voices available'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function ChipSelect({ options, value, onChange, activeColor = '#B44CFF' }: { options: string[]; value: string; onChange: (v: string) => void; activeColor?: string }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {options.map(o => (
        <TouchableOpacity key={o} style={[s.chip, { backgroundColor: value === o ? activeColor : colors.muted }]} onPress={() => onChange(o)}>
          <Text style={[s.chipText, { color: value === o ? '#fff' : colors.foreground }]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function LanguageDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <TouchableOpacity style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setOpen(o => !o)}>
        <Text style={[s.dropdownText, { color: colors.foreground }]} numberOfLines={1}>{value}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      {open && (
        <View style={[s.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {SONG_LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang}
              style={[s.dropdownItem, value === lang && { backgroundColor: '#FF6B3320' }]}
              onPress={() => { onChange(lang); setOpen(false); }}
            >
              <Text style={[s.dropdownItemText, { color: value === lang ? '#FF6B33' : colors.foreground, flex: 1 }]}>{lang}</Text>
              {value === lang && <Icon name="check" size={14} color="#FF6B33" />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function DurationSlider({ value, onChange, min = 1, max = 30, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  const { colors } = useTheme();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <View>
      <View style={s.sliderRow}>
        <TouchableOpacity style={[s.sliderBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => onChange(Math.max(min, value - step))}>
          <Icon name="minus" size={16} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[s.sliderTrack, { backgroundColor: colors.muted }]}>
          <View style={[s.sliderFill, { width: `${pct}%` }]} />
        </View>
        <TouchableOpacity style={[s.sliderBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => onChange(Math.min(max, value + step))}>
          <Icon name="plus" size={16} color={colors.foreground} />
        </TouchableOpacity>
      </View>
      <Text style={[s.sliderLabel, { color: colors.mutedForeground }]}>{value}s</Text>
    </View>
  );
}

function GenBtn({ label, onPress, generating, disabled }: { label: string; onPress: () => void; generating: boolean; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={generating || disabled} style={{ marginTop: 16, opacity: (generating || disabled) ? 0.6 : 1 }} activeOpacity={0.85}>
      <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.genBtn}>
        <Icon name="zap" size={18} color="#fff" />
        <Text style={s.genBtnText}>{generating ? 'Generating...' : label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function SL({ text }: { text: string }) {
  const { colors } = useTheme();
  return <Text style={[s.sectionLabel, { color: colors.foreground }]}>{text}</Text>;
}

function ErrBox({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <View style={s.errBox}>
      <Icon name="alert-circle" size={14} color="#ef4444" />
      <Text style={s.errorText}>{msg}</Text>
    </View>
  );
}

function InfoBox({ msg, color = '#B44CFF' }: { msg: string; color?: string }) {
  return (
    <View style={[s.infoBox, { backgroundColor: color + '15', borderColor: color + '40' }]}>
      <Icon name="info" size={14} color={color} />
      <Text style={[s.infoText, { color }]}>{msg}</Text>
    </View>
  );
}

function WalletCard({ balance }: { balance: number }) {
  const { colors } = useTheme();
  const prices = [
    ['TTS', `₹${COSTS.tts}`],
    ['Voice Conversion', `₹${COSTS.voiceConversion}`],
    ['SFX', `₹${COSTS.sfx}`],
    ['Audio Isolation', `₹${COSTS.audioIsolation}`],
    ['Instrumental', `₹${COSTS.instrumental}`],
    ['Full Song', `₹${COSTS.fullSong}`],
    ['Voice Clone', `₹${COSTS.voiceClone}`],
    ['Img+Music', `₹${COSTS.imgInstrumental}/₹${COSTS.imgVocals}`],
  ];
  return (
    <View style={[s.walletCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={s.walletRow}>
        <Icon name="wallet" size={20} color="#B44CFF" />
        <Text style={[s.walletLabel, { color: colors.mutedForeground }]}>Wallet Balance</Text>
        <Text style={s.walletBalance}>₹{balance.toLocaleString('en-IN')}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.priceRow}>
        {prices.map(([name, price]) => (
          <View key={name} style={[s.priceChip, { backgroundColor: colors.muted }]}>
            <Text style={[s.priceChipName, { color: colors.mutedForeground }]}>{name}</Text>
            <Text style={[s.priceChipVal, { color: colors.foreground }]}>{price}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function buildMp4ViaCanvas(imgSrc: string, audioDataUri: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 450;
      const ctx2d = canvas.getContext('2d');
      if (!ctx2d) { resolve(); return; }
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx2d.drawImage(img, 0, 0, 800, 450);
        const stream = canvas.captureStream(1);
        const mimeType =
          typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/mp4')
            ? 'video/mp4'
            : 'video/webm';
        if (typeof MediaRecorder === 'undefined') { resolve(); return; }
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e: BlobEvent) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `wishme_video_${Date.now()}.${mimeType === 'video/mp4' ? 'mp4' : 'webm'}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          resolve();
        };
        try {
          const audioBase64 = audioDataUri.includes(',') ? audioDataUri.split(',')[1] : audioDataUri;
          const binary = atob(audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const audioCtx = new AudioContext();
          audioCtx.decodeAudioData(bytes.buffer.slice(0)).then((buffer) => {
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            const dest = audioCtx.createMediaStreamDestination();
            source.connect(dest);
            stream.addTrack(dest.stream.getAudioTracks()[0]);
            recorder.start();
            source.start();
            setTimeout(() => { recorder.stop(); source.stop(); audioCtx.close(); }, buffer.duration * 1000 + 300);
          }).catch(() => {
            recorder.start();
            setTimeout(() => recorder.stop(), 5000);
          });
        } catch {
          recorder.start();
          setTimeout(() => recorder.stop(), 5000);
        }
      };
      img.onerror = () => resolve();
      img.src = imgSrc;
    } catch {
      resolve();
    }
  });
}

function ImgMusicResult({ audioUrl, imgBase64, hasVocals, videoUrl }: {
  audioUrl: string;
  imgBase64: string;
  hasVocals: boolean;
  videoUrl?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioSaved, setAudioSaved] = useState(false);
  const [videoSaved, setVideoSaved] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => () => { soundRef.current?.unloadAsync().catch(() => {}); }, []);

  const toggle = async () => {
    if (loading) return;
    if (!soundRef.current) {
      setLoading(true);
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
        const isRemoteUrl = audioUrl.startsWith('http://') || audioUrl.startsWith('https://');
        const uri = isRemoteUrl ? audioUrl : await saveAudioToCache(audioUrl);
        const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
        sound.setOnPlaybackStatusUpdate(st => {
          if (st.isLoaded && st.didJustFinish) setPlaying(false);
        });
        soundRef.current = sound;
        setPlaying(true);
      } catch {}
      setLoading(false);
      return;
    }
    if (playing) { await soundRef.current.pauseAsync(); setPlaying(false); }
    else { await soundRef.current.playAsync(); setPlaying(true); }
  };

  const stopPlayback = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setPlaying(false);
  };

  const saveAudio = async () => {
    try {
      const isMP3 = audioUrl.startsWith('data:audio/mpeg') || audioUrl.endsWith('.mp3');
      const ext = isMP3 ? 'mp3' : audioUrl.startsWith('data:audio/mp4') || audioUrl.startsWith('data:audio/m4a') ? 'm4a' : 'wav';
      if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
        await downloadUrlToDevice(audioUrl, `wishme_audio_${Date.now()}.${ext}`);
      } else {
        await downloadToDevice(audioUrl, `wishme_audio_${Date.now()}.${ext}`);
      }
      setAudioSaved(true);
      setTimeout(() => setAudioSaved(false), 2500);
    } catch (err) {
      const msg = err instanceof Error && err.message === 'media_library_permission_denied'
        ? 'Please allow media library access to save audio to your device.'
        : 'Could not save the audio. Please try again.';
      Alert.alert('Save Failed', msg);
    }
  };

  const downloadMp4 = async () => {
    try {
      if (Platform.OS === 'web') {
        await buildMp4ViaCanvas(imgBase64, audioUrl);
      } else if (videoUrl) {
        const filename = `wishme_video_${Date.now()}.mp4`;
        if (videoUrl.startsWith('data:') || videoUrl.startsWith('file://')) {
          await downloadToDevice(videoUrl, filename);
        } else {
          await downloadUrlToDevice(videoUrl, filename);
        }
      } else {
        return;
      }
      setVideoSaved(true);
      setTimeout(() => setVideoSaved(false), 2500);
    } catch (err) {
      const msg = err instanceof Error && err.message === 'media_library_permission_denied'
        ? 'Please allow media library access to save video to your device.'
        : 'Could not save the video. Please try again.';
      Alert.alert('Save Failed', msg);
    }
  };

  return (
    <View style={s.imgMusicResult}>
      <View style={{ borderRadius: 16, overflow: 'hidden' }}>
        <Image source={{ uri: imgBase64 }} style={{ width: '100%', height: 220 }} resizeMode="cover" />
        <View style={s.imgOverlay}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity style={s.overlayPlayBtn} onPress={toggle} disabled={loading} activeOpacity={0.8}>
              <Icon name={loading ? 'refresh-cw' : playing ? 'pause' : 'play'} size={30} color="#fff" />
            </TouchableOpacity>
            {(playing || soundRef.current !== null) ? (
              <TouchableOpacity style={[s.overlayPlayBtn, { width: 44, height: 44 }]} onPress={stopPlayback} activeOpacity={0.8}>
                <Icon name="volume-x" size={20} color="#fff" />
              </TouchableOpacity>
            ) : null}
          </View>
          {playing && (
            <View style={s.imgWaveRow}>
              {Array.from({ length: 10 }).map((_, i) => <WaveformBar key={i} delay={i * 80} color="#fff" active={true} />)}
            </View>
          )}
        </View>
        {hasVocals && (
          <View style={s.imgBadgeTop}>
            <Icon name="music" size={12} color="#fff" />
            <Text style={s.imgBadgeText}>AI Vocals</Text>
          </View>
        )}
      </View>
      <View style={s.imgMusicActions}>
        <TouchableOpacity style={[s.actionBtn, { flex: 1, borderColor: '#B44CFF', borderWidth: 1.5 }]} onPress={saveAudio}>
          <Icon name={audioSaved ? 'check' : 'download'} size={15} color="#B44CFF" />
          <Text style={[s.actionBtnText, { color: '#B44CFF' }]}>{audioSaved ? 'Audio Saved!' : 'Save Audio'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, { flex: 1, backgroundColor: '#B44CFF' }]} onPress={downloadMp4}>
          <Icon name={videoSaved ? 'check' : 'download'} size={15} color="#fff" />
          <Text style={[s.actionBtnText, { color: '#fff' }]}>{videoSaved ? 'Saved!' : 'Download MP4'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function GenerateSongTab({ ctx }: { ctx: MusicCtx }) {
  const { colors } = useTheme();
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
      const data = await res.json() as { lyrics?: string };
      if (data.lyrics) setLyrics(data.lyrics);
    } catch {}
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
      <ChipSelect options={GENERATE_SONG_GENRES} value={genre} onChange={setGenre} activeColor="#FF6B33" />
      <SL text="Mood" />
      <ChipSelect options={GENERATE_SONG_MOODS} value={mood} onChange={setMood} activeColor="#B44CFF" />
      {songType === 'full' ? (
        <>
          <View style={s.lyricHeader}>
            <SL text="Lyrics" />
            <TouchableOpacity style={[s.aiLyricsBtn, { borderColor: '#FF6B33' }]} onPress={generateLyrics} disabled={lyricsGen}>
              <Icon name="sparkles" size={13} color="#FF6B33" />
              <Text style={[s.aiLyricsBtnText, { color: '#FF6B33' }]}>{lyricsGen ? 'Generating...' : 'Generate Lyrics'}</Text>
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
        <View style={[s.resultPanel, s.resultPanelLoading, { backgroundColor: colors.card, borderColor: '#FF6B33' }]}>
          <View style={s.waveRow}>
            {Array.from({ length: 16 }).map((_, i) => (
              <WaveformBar key={i} delay={i * 60} color="#FF6B33" active={true} />
            ))}
          </View>
          <Text style={[s.generatingText, { color: colors.foreground }]}>{progressMsg || 'Starting generation...'}</Text>
          <Text style={[s.generatingHint, { color: colors.mutedForeground }]}>This may take up to 5 minutes</Text>
          <View style={[s.genSpinner, { borderColor: '#FF6B33' + '30', borderTopColor: '#FF6B33' }]} />
        </View>
      ) : audioUrl ? (
        <View style={[s.resultPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <AudioPlayerCard title={songTitle || `${genre} ${songType === 'full' ? 'Song' : 'Instrumental'}`} audioUri={audioUrl} badge={songType === 'full' ? 'Full Song' : 'Instrumental'} />
        </View>
      ) : (
        <View style={[s.resultPanel, s.resultPanelEmpty, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <LinearGradient colors={['#7B2FFF20', '#FF6B3320']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.resultEmptyGradient}>
            <Icon name="music" size={32} color="#FF6B33" />
            <Text style={[s.resultEmptyTitle, { color: colors.foreground }]}>Your song will appear here</Text>
            <Text style={[s.resultEmptyHint, { color: colors.mutedForeground }]}>Fill in the details above and tap Generate Song</Text>
            <View style={s.decorativeWaveRow}>
              {Array.from({ length: 20 }).map((_, i) => (
                <WaveformBar key={i} delay={i * 50} color={'#FF6B33'} active={false} />
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

function TTSTab({ ctx }: { ctx: MusicCtx }) {
  const { colors } = useTheme();
  const [voice, setVoice] = useState<VoiceItem | null>(null);
  const [text, setText] = useState('');
  const [gen, setGen] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [err, setErr] = useState('');

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

function VoiceConversionTab({ ctx }: { ctx: MusicCtx }) {
  const { colors } = useTheme();
  const [voice, setVoice] = useState<VoiceItem | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [gen, setGen] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const all = [...ctx.voices.clonedVoices, ...ctx.voices.premadeVoices];
    if (all.length && !voice) setVoice(all[0]);
  }, [ctx.voices]);

  const handleAudio = (base64: string, name: string) => { setAudioBase64(base64); setAudioFileName(name); };
  const clearAudio = () => { setAudioBase64(null); setAudioFileName(null); };

  const generate = async () => {
    if (!audioBase64) { setErr('Please upload or record audio.'); return; }
    if (!voice) { setErr('Please select a target voice.'); return; }
    if (ctx.walletBalance < COSTS.voiceConversion) { setErr(`Insufficient balance. You need ₹${COSTS.voiceConversion}.`); return; }
    setErr(''); setGen(true); setAudioUri(null);
    try {
      const res = await supabaseFetch('/functions/v1/elevenlabs-speech-to-speech', {
        method: 'POST',
        body: JSON.stringify({ audioBase64, voiceId: voice.voice_id }),
      }, ctx.session?.access_token);
      const data = await res.json() as { success: boolean; audioUrl: string; error?: string };
      if (!data.success || !data.audioUrl) throw new Error(data.error ?? 'Conversion failed');
      await supabaseFetch('/rest/v1/voice_conversion_generations', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' } as Record<string, string>,
        body: JSON.stringify({ user_id: ctx.profileId, original_file_name: audioFileName ?? 'audio.wav', target_voice_id: voice.voice_id, target_voice_name: voice.name, audio_url: data.audioUrl, status: 'completed', credits_used: COSTS.voiceConversion }),
      }, ctx.session?.access_token);
      setAudioUri(data.audioUrl);
      ctx.refreshWallet();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Conversion failed');
    } finally {
      setGen(false);
    }
  };

  return (
    <View style={s.tabContent}>
      <SL text="Upload or Record Audio" />
      <UploadOrRecord audioFileName={audioFileName} onAudio={handleAudio} onClear={clearAudio} />
      <SL text="Target Voice" />
      <VoiceSelect value={voice} onChange={setVoice} voices={ctx.voices} voicesLoading={ctx.voicesLoading} />
      <ErrBox msg={err} />
      <GenBtn label={`Convert Voice (₹${COSTS.voiceConversion})`} onPress={generate} generating={gen} disabled={!audioBase64} />
      {audioUri && <AudioPlayerCard title="Voice-Converted Audio" audioUri={audioUri} />}
    </View>
  );
}

function SFXTab({ ctx }: { ctx: MusicCtx }) {
  const { colors } = useTheme();
  const [desc, setDesc] = useState('');
  const [duration, setDuration] = useState(5);
  const [gen, setGen] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [err, setErr] = useState('');

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

function CloneTab({ ctx }: { ctx: MusicCtx }) {
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
      <InfoBox msg="For best results, record 1–5 minutes of clear, natural speech." color="#FF6B33" />
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

function IsolateTab({ ctx }: { ctx: MusicCtx }) {
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

function ImageMusicTab({ ctx }: { ctx: MusicCtx }) {
  const { colors } = useTheme();
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [musicSource, setMusicSource] = useState<'generate' | 'upload'>('generate');
  const [desc, setDesc] = useState('');
  const [genre, setGenre] = useState(IMG_MUSIC_GENRES[0]);
  const [mood, setMood] = useState(IMG_MUSIC_MOODS[0]);
  const [lyrics, setLyrics] = useState('');
  const [duration, setDuration] = useState(30);
  const [uploadedAudioBase64, setUploadedAudioBase64] = useState<string | null>(null);
  const [uploadedAudioName, setUploadedAudioName] = useState<string | null>(null);
  const [gen, setGen] = useState(false);
  const [lyricsGen, setLyricsGen] = useState(false);
  const [result, setResult] = useState<{ audioUrl: string; hasVocals: boolean; imgBase64: string; videoUrl?: string } | null>(null);
  const [err, setErr] = useState('');

  const generateLyrics = async () => {
    setLyricsGen(true);
    try {
      const res = await supabaseFetch('/functions/v1/generate-lyrics', {
        method: 'POST',
        body: JSON.stringify({ description: desc.trim() || 'a beautiful scene', genre, mood }),
      }, ctx.session?.access_token);
      const data = await res.json() as { lyrics?: string };
      if (data.lyrics) setLyrics(data.lyrics);
    } catch {}
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
        uploadedAudioBase64: musicSource === 'upload' ? uploadedAudioBase64 : null,
      };
      const res = await supabaseFetch('/functions/v1/elevenlabs-image-music-video', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, ctx.session?.access_token);
      const data = await res.json() as { success: boolean; audioUrl: string; videoUrl?: string; imageBase64?: string; hasVocals?: boolean; error?: string };
      if (!data.success || !data.audioUrl) throw new Error(data.error ?? 'Generation failed');

      const amountCharged = data.hasVocals ? COSTS.imgVocals : COSTS.imgInstrumental;
      await supabaseFetch('/rest/v1/image_music_generations', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' } as Record<string, string>,
        body: JSON.stringify({
          user_id: ctx.profileId,
          image_url: imageBase64,
          audio_url: data.audioUrl,
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
        audioUrl: data.audioUrl,
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
          <ChipSelect options={IMG_MUSIC_GENRES} value={genre} onChange={setGenre} activeColor="#B44CFF" />
          <SL text="Mood" />
          <ChipSelect options={IMG_MUSIC_MOODS} value={mood} onChange={setMood} activeColor="#FF6B33" />
          <View style={s.lyricHeader}>
            <SL text="Lyrics (optional)" />
            <TouchableOpacity style={[s.aiLyricsBtn, { borderColor: '#B44CFF' }]} onPress={generateLyrics} disabled={lyricsGen}>
              <Icon name="zap" size={13} color="#B44CFF" />
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

export default function MusicScreen() {
  const { colors } = useTheme();
  const { user, session } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(0);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const { voices, loading: voicesLoading, refetch: refetchVoices } = useVoices();
  const { balance: walletBalance, profileId, refetch: refetchWallet } = useWallet();

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false }).catch(() => {});
    refetchVoices();
    refetchWallet();
  }, [refetchVoices, refetchWallet]);

  const ctx: MusicCtx = {
    voices,
    voicesLoading,
    walletBalance,
    refreshWallet: refetchWallet,
    session,
    profileId,
    onVoiceCloned: refetchVoices,
  };

  const TABS: React.ReactElement[] = [
    <GenerateSongTab ctx={ctx} />,
    <TTSTab ctx={ctx} />,
    <VoiceConversionTab ctx={ctx} />,
    <SFXTab ctx={ctx} />,
    <CloneTab ctx={ctx} />,
    <IsolateTab ctx={ctx} />,
    <ImageMusicTab ctx={ctx} />,
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={[{ flex: 1 }, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#7B2FFF', '#B44CFF', '#E8527A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.header, { paddingTop: topPad + 12 }]}>
          <Text style={s.headerTagline}><Text style={s.headerTaglineItalic}>Your Symphony,{'\n'}Powered by AI.</Text></Text>
        </LinearGradient>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <WalletCard balance={walletBalance} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBar} style={[s.tabBarWrap, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          {MUSIC_TABS.map((tab, i) => (
            <TouchableOpacity
              key={tab.label}
              style={[s.tabPill, activeTab === i && s.tabPillActive]}
              onPress={() => setActiveTab(i)}
              activeOpacity={0.8}
            >
              <Icon name={tab.icon as Parameters<typeof Icon>[0]['name']} size={13} color={activeTab === i ? '#fff' : 'rgba(255,255,255,0.5)'} />
              <Text style={[s.tabPillText, { color: activeTab === i ? '#fff' : 'rgba(255,255,255,0.5)' }]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {TABS[activeTab]}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerTagline: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', color: '#fff', lineHeight: 34 },
  headerTaglineItalic: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', fontStyle: 'italic', color: '#fff', lineHeight: 34 },
  walletCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 4, gap: 10 },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  walletLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
  walletBalance: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#B44CFF' },
  priceRow: { gap: 8, paddingVertical: 2 },
  priceChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', gap: 2 },
  priceChipName: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  priceChipVal: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  tabBarWrap: { borderBottomWidth: 1 },
  tabBar: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: 'transparent',
  },
  tabPillActive: {
    backgroundColor: '#FF6B33',
    shadowColor: '#FF6B33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 4,
  },
  tabPillText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  tabContent: { padding: 20, gap: 4 },
  sectionLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 16, marginBottom: 8 },
  chips: { gap: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 9999 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  input: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, height: 48 },
  textarea: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  genBtn: { height: 52, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  genBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  playerCard: { marginTop: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  playerGradient: { padding: 18 },
  playerTitle: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 36, marginVertical: 12 },
  playerControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  playerDuration: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium', flex: 1 },
  dlBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999 },
  dlText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium' },
  badgePill: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 9999 },
  badgeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  recorderBtn: { borderRadius: 12, borderWidth: 1.5, padding: 16, alignItems: 'center' },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ef4444' },
  recLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  recHint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  recorderPreview: { borderRadius: 12, borderWidth: 1.5, padding: 16, gap: 10, flexDirection: 'row', alignItems: 'center' },
  recDuration: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  reRecordBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  reRecordText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  uploadOrRec: { gap: 8 },
  uploadBtn: { borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  uploadText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  orDivider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divLine: { flex: 1, height: 1 },
  orText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  dropdown: { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { fontSize: 14, fontFamily: 'Inter_400Regular', flex: 1 },
  dropdownList: { borderRadius: 12, borderWidth: 1.5, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  dropdownItemText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  voiceGroupHeader: { paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1 },
  voiceGroupLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  voiceGroupDivider: { height: 1, marginVertical: 4 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sliderBtn: { width: 36, height: 36, borderRadius: 9999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  sliderTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  sliderFill: { height: 6, backgroundColor: '#B44CFF', borderRadius: 3 },
  sliderLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 4 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 8 },
  infoText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#B44CFF', flex: 1 },
  errBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  errorText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#ef4444', flex: 1 },
  lyricHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 },
  aiLyricsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  aiLyricsBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#B44CFF' },
  radioGroup: { gap: 10 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#B44CFF' },
  radioText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  successCard: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center', gap: 12, marginTop: 16 },
  successIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#22c55e20', alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  successSub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  imageUploadArea: { height: 140, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8 },
  imageUploadText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  imagePreview: { borderRadius: 16, borderWidth: 2, overflow: 'hidden' },
  changeImageBtn: { padding: 12, alignItems: 'center', backgroundColor: 'rgba(180,76,255,0.12)' },
  changeImageText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#B44CFF' },
  toggleRow: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1 },
  toggleOpt: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  toggleOptActive: { backgroundColor: '#B44CFF' },
  toggleOptText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  imgMusicResult: { marginTop: 16, borderRadius: 16, overflow: 'hidden' },
  imgOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' },
  overlayPlayBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(180,76,255,0.85)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  imgWaveRow: { position: 'absolute', bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 3 },
  imgBadgeTop: { position: 'absolute', top: 10, right: 10, backgroundColor: '#B44CFF', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  imgBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  imgMusicActions: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: '#1a1a2e' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  actionBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  generatingBox: { borderRadius: 16, borderWidth: 1, padding: 20, alignItems: 'center', gap: 8, marginTop: 8 },
  generatingText: { fontSize: 14, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  generatingHint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  resultPanel: { borderRadius: 16, borderWidth: 1, marginTop: 16, overflow: 'hidden' },
  resultPanelEmpty: { minHeight: 200 },
  resultPanelLoading: { padding: 24, alignItems: 'center', gap: 10 },
  resultEmptyGradient: { flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  resultEmptyTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  resultEmptyHint: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  decorativeWaveRow: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 36, opacity: 0.4, marginTop: 4 },
  resultControls: { flexDirection: 'row', gap: 10, marginTop: 4 },
  resultControlBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', opacity: 0.5 },
  genSpinner: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, marginTop: 4 },
});
