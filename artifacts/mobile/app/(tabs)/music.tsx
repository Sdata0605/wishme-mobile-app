import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
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

interface VoiceItem {
  voice_id: string;
  name: string;
  category: string;
  preview_url?: string;
}

interface VoiceList {
  premadeVoices: VoiceItem[];
  clonedVoices: VoiceItem[];
}

interface MusicCtx {
  voices: VoiceList;
  voicesLoading: boolean;
  walletBalance: number;
  refreshWallet: () => void;
  session: { access_token: string } | null;
  userId: string;
  onVoiceCloned: () => void;
}

interface MusicResult {
  twoTrack: boolean;
  audioUrl?: string;
  instrumentalUrl?: string;
  vocalsUrl?: string;
}

const MUSIC_TABS = ['TTS', 'Convert', 'Clone', 'SFX', 'Isolate', 'Music', 'Img+Music'];
const MUSIC_GENRES = ['pop', 'rock', 'r&b', 'hip-hop', 'jazz', 'classical', 'electronic', 'country', 'folk', 'ambient'];
const MUSIC_MOODS = ['happy', 'sad', 'energetic', 'calm', 'romantic', 'epic', 'melancholic', 'uplifting'];
const IMG_MUSIC_GENRES = ['ambient', 'pop', 'classical', 'electronic', 'rock', 'r&b'];
const IMG_MUSIC_MOODS = ['calm', 'happy', 'romantic', 'epic', 'sad', 'energetic'];

const COSTS = { tts: 50, convert: 75, clone: 150, sfx: 60, isolate: 40, music_base: 100, music_cloned: 150, img_base: 120, img_vocals: 150 };

async function saveAudioToCache(dataUri: string): Promise<string> {
  const isMP3 = dataUri.startsWith('data:audio/mpeg');
  const ext = isMP3 ? 'mp3' : 'wav';
  const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
  const path = (FileSystem.cacheDirectory ?? '') + `wishme_${Date.now()}.${ext}`;
  await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
  return path;
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
      const filePath = await saveAudioToCache(audioUri);
      const { sound } = await Audio.Sound.createAsync({ uri: filePath }, { shouldPlay: true });
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

  const saveAudio = async () => {
    try {
      const docDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';
      const path = docDir + `wishme_audio_${Date.now()}.mp3`;
      const base64 = audioUri.includes(',') ? audioUri.split(',')[1] : audioUri;
      await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
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
          <Text style={s.playerDuration}>{positionLabel} / {durationLabel}</Text>
          <TouchableOpacity style={s.dlBtn} onPress={saveAudio}>
            <Icon name={saved ? 'check' : 'download'} size={15} color="#fff" />
            <Text style={s.dlText}>{saved ? 'Saved!' : 'Save'}</Text>
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
        const base64 = await fileUriToBase64(uri, 'audio/wav');
        onAudio(base64, 'recording.wav');
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
          <Text style={s.changeImageText}>Change</Text>
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
    ['TTS', '₹50'], ['Convert', '₹75'], ['Clone', '₹150'],
    ['SFX', '₹60'], ['Isolate', '₹40'], ['Music', '₹100/₹150'], ['Img+Music', '₹120/₹150'],
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
        body: JSON.stringify({ user_id: ctx.userId, text: text.slice(0, 500), voice_id: voice.voice_id, voice_name: voice.name, audio_url: data.audioUrl, status: 'completed', credits_used: COSTS.tts }),
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

function ConvertTab({ ctx }: { ctx: MusicCtx }) {
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
    if (ctx.walletBalance < COSTS.convert) { setErr(`Insufficient balance. You need ₹${COSTS.convert}.`); return; }
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
        body: JSON.stringify({ user_id: ctx.userId, original_file_name: audioFileName ?? 'audio.wav', target_voice_id: voice.voice_id, target_voice_name: voice.name, audio_url: data.audioUrl, status: 'completed', credits_used: COSTS.convert }),
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
      <GenBtn label={`Convert Voice (₹${COSTS.convert})`} onPress={generate} generating={gen} disabled={!audioBase64} />
      {audioUri && <AudioPlayerCard title="Voice-Converted Audio" audioUri={audioUri} />}
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
    if (ctx.walletBalance < COSTS.clone) { setErr(`Insufficient balance. You need ₹${COSTS.clone}.`); return; }
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
      <GenBtn label={`Clone Voice (₹${COSTS.clone})`} onPress={generate} generating={gen} disabled={!audioBase64} />
      {done && (
        <View style={[s.successCard, { backgroundColor: '#22c55e15', borderColor: '#22c55e40' }]}>
          <View style={s.successIcon}><Icon name="check-circle" size={28} color="#22c55e" /></View>
          <Text style={[s.successTitle, { color: '#22c55e' }]}>Voice Cloned!</Text>
          <Text style={[s.successSub, { color: '#22c55e99' }]}>"{voiceName}" is ready to use in TTS, Convert, and Music tabs.</Text>
        </View>
      )}
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
        body: JSON.stringify({ user_id: ctx.userId, description: desc.slice(0, 500), duration_seconds: duration, audio_url: data.audioUrl, status: 'completed', credits_used: COSTS.sfx }),
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

function IsolateTab({ ctx }: { ctx: MusicCtx }) {
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [gen, setGen] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const handleAudio = (base64: string, name: string) => { setAudioBase64(base64); setAudioFileName(name); };

  const generate = async () => {
    if (!audioBase64) { setErr('Please upload an audio file.'); return; }
    if (ctx.walletBalance < COSTS.isolate) { setErr(`Insufficient balance. You need ₹${COSTS.isolate}.`); return; }
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
        body: JSON.stringify({ user_id: ctx.userId, original_file_name: audioFileName ?? 'audio.wav', audio_url: data.audioUrl, status: 'completed', credits_used: COSTS.isolate }),
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
      <GenBtn label={`Isolate Audio (₹${COSTS.isolate})`} onPress={generate} generating={gen} disabled={!audioBase64} />
      {audioUri && <AudioPlayerCard title="Isolated Audio" audioUri={audioUri} />}
    </View>
  );
}

function MusicTab({ ctx }: { ctx: MusicCtx }) {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState(MUSIC_GENRES[0]);
  const [mood, setMood] = useState(MUSIC_MOODS[0]);
  const [desc, setDesc] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [voiceType, setVoiceType] = useState<'instrumental' | 'ai' | 'cloned'>('instrumental');
  const [clonedVoice, setClonedVoice] = useState<VoiceItem | null>(null);
  const [gen, setGen] = useState(false);
  const [lyricsGen, setLyricsGen] = useState(false);
  const [result, setResult] = useState<MusicResult | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (ctx.voices.clonedVoices.length && !clonedVoice) setClonedVoice(ctx.voices.clonedVoices[0]);
  }, [ctx.voices]);

  const cost = voiceType === 'cloned' ? COSTS.music_cloned : COSTS.music_base;
  const showLyrics = voiceType === 'ai' || voiceType === 'cloned';
  const hasClonedVoices = ctx.voices.clonedVoices.length > 0;

  const generateLyrics = async () => {
    if (!desc.trim() && !title.trim()) { setErr('Enter a description first to generate lyrics.'); return; }
    setErr(''); setLyricsGen(true);
    try {
      const res = await supabaseFetch('/functions/v1/generate-lyrics', {
        method: 'POST',
        body: JSON.stringify({ description: desc.trim() || title.trim(), genre, mood }),
      }, ctx.session?.access_token);
      const data = await res.json() as { lyrics?: string; error?: string };
      if (data.lyrics) setLyrics(data.lyrics);
    } catch {}
    setLyricsGen(false);
  };

  const generate = async () => {
    if (!desc.trim()) { setErr('Please enter a description.'); return; }
    if (voiceType === 'cloned' && !clonedVoice) { setErr('Please select a cloned voice.'); return; }
    if (ctx.walletBalance < cost) { setErr(`Insufficient balance. You need ₹${cost}.`); return; }
    setErr(''); setGen(true); setResult(null);

    try {
      await supabaseFetch('/rest/v1/wallet_transactions', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' } as Record<string, string>,
        body: JSON.stringify({ user_id: ctx.userId, transaction_type: 'music_generation', amount: cost, status: 'completed', payment_method: 'wallet', description: `AI Music: ${title || 'Untitled'} (${genre})` }),
      }, ctx.session?.access_token);

      let payload: Record<string, unknown> = { songTitle: title.trim() || 'Untitled', genre, mood, description: desc.trim() };
      if (voiceType === 'instrumental') {
        payload = { ...payload, isInstrumental: true };
      } else if (voiceType === 'ai') {
        payload = { ...payload, isInstrumental: false, lyrics };
      } else {
        payload = { ...payload, isInstrumental: false, lyrics, voiceId: clonedVoice?.voice_id, generateVocals: true };
      }

      const res = await supabaseFetch('/functions/v1/elevenlabs-generate-music', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, ctx.session?.access_token);
      const data = await res.json() as { success: boolean; twoTrack?: boolean; audioUrl?: string; instrumentalUrl?: string; vocalsUrl?: string; error?: string };
      if (!data.success) throw new Error(data.error ?? 'Generation failed');

      if (data.twoTrack) {
        setResult({ twoTrack: true, instrumentalUrl: data.instrumentalUrl, vocalsUrl: data.vocalsUrl });
      } else {
        setResult({ twoTrack: false, audioUrl: data.audioUrl });
      }
      ctx.refreshWallet();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGen(false);
    }
  };

  const VOICE_TYPE_OPTS: Array<{ key: 'instrumental' | 'ai' | 'cloned'; label: string; cost: number }> = [
    { key: 'instrumental', label: 'Instrumental', cost: 100 },
    { key: 'ai', label: 'AI Vocals', cost: 100 },
    { key: 'cloned', label: 'My Voice (Cloned)', cost: 150 },
  ];

  return (
    <View style={s.tabContent}>
      <SL text="Song Title (optional)" />
      <TextInput style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
        placeholder="My Birthday Song" placeholderTextColor={colors.mutedForeground} value={title} onChangeText={setTitle} />
      <SL text="Description" />
      <TextInput style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
        placeholder="A romantic song for an anniversary with classical elements..." placeholderTextColor={colors.mutedForeground}
        value={desc} onChangeText={setDesc} multiline numberOfLines={3} />
      <SL text="Genre" />
      <ChipSelect options={MUSIC_GENRES} value={genre} onChange={setGenre} activeColor="#B44CFF" />
      <SL text="Mood" />
      <ChipSelect options={MUSIC_MOODS} value={mood} onChange={setMood} activeColor="#FF6B33" />
      <SL text="Voice Type" />
      <View style={s.radioGroup}>
        {VOICE_TYPE_OPTS.map(opt => (
          <TouchableOpacity key={opt.key} style={s.radioRow} onPress={() => setVoiceType(opt.key)}
            disabled={opt.key === 'cloned' && !hasClonedVoices}>
            <View style={[s.radioOuter, { borderColor: voiceType === opt.key ? '#B44CFF' : colors.border, opacity: opt.key === 'cloned' && !hasClonedVoices ? 0.4 : 1 }]}>
              {voiceType === opt.key && <View style={s.radioInner} />}
            </View>
            <Text style={[s.radioText, { color: colors.foreground, opacity: opt.key === 'cloned' && !hasClonedVoices ? 0.4 : 1 }]}>
              {opt.label} <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>₹{opt.cost}</Text>
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {voiceType === 'cloned' && hasClonedVoices && (
        <>
          <SL text="Select Cloned Voice" />
          <VoiceSelect
            value={clonedVoice}
            onChange={setClonedVoice}
            voices={{ premadeVoices: [], clonedVoices: ctx.voices.clonedVoices }}
            voicesLoading={ctx.voicesLoading}
          />
        </>
      )}
      {showLyrics && (
        <>
          <View style={s.lyricHeader}>
            <SL text={voiceType === 'cloned' ? 'Lyrics (required)' : 'Lyrics (optional)'} />
            <TouchableOpacity style={[s.aiLyricsBtn, { borderColor: '#B44CFF' }]} onPress={generateLyrics} disabled={lyricsGen}>
              <Icon name="zap" size={13} color="#B44CFF" />
              <Text style={s.aiLyricsBtnText}>{lyricsGen ? 'Generating...' : 'AI Generate'}</Text>
            </TouchableOpacity>
          </View>
          <TextInput style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular', minHeight: 100 }]}
            placeholder="Enter lyrics or use AI Generate..." placeholderTextColor={colors.mutedForeground}
            value={lyrics} onChangeText={setLyrics} multiline numberOfLines={6} />
        </>
      )}
      <ErrBox msg={err} />
      <GenBtn label={`Generate Music (₹${cost})`} onPress={generate} generating={gen} />
      {result && !result.twoTrack && result.audioUrl && (
        <AudioPlayerCard title={title || `${mood} ${genre} song`} audioUri={result.audioUrl} />
      )}
      {result && result.twoTrack && (
        <View style={{ gap: 12, marginTop: 16 }}>
          {result.instrumentalUrl && <AudioPlayerCard title="Instrumental Track" audioUri={result.instrumentalUrl} badge="Instrumental" />}
          {result.vocalsUrl && <AudioPlayerCard title="Vocals Track" audioUri={result.vocalsUrl} badge="Your Voice" />}
        </View>
      )}
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
  const [result, setResult] = useState<{ audioUrl: string; hasVocals: boolean; imgBase64: string } | null>(null);
  const [err, setErr] = useState('');

  const cost = result?.hasVocals ? COSTS.img_vocals : COSTS.img_base;

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
    const estimatedCost = lyrics.trim() ? COSTS.img_vocals : COSTS.img_base;
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
      const data = await res.json() as { success: boolean; audioUrl: string; imageBase64?: string; hasVocals?: boolean; error?: string };
      if (!data.success || !data.audioUrl) throw new Error(data.error ?? 'Generation failed');

      const amountCharged = data.hasVocals ? COSTS.img_vocals : COSTS.img_base;
      await supabaseFetch('/rest/v1/image_music_generations', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' } as Record<string, string>,
        body: JSON.stringify({
          user_id: ctx.userId,
          image_url: imageBase64,
          audio_url: data.audioUrl,
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

      setResult({ audioUrl: data.audioUrl, hasVocals: data.hasVocals ?? false, imgBase64: data.imageBase64 ?? imageBase64 });
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
      <GenBtn label={`Create (₹${lyrics.trim() ? COSTS.img_vocals : COSTS.img_base})`} onPress={generate} generating={gen} disabled={!imageBase64} />
      {result && (
        <View style={[s.playerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {result.imgBase64 && (
            <View style={{ position: 'relative' }}>
              <Image source={{ uri: result.imgBase64 }} style={{ width: '100%', height: 200, borderTopLeftRadius: 16, borderTopRightRadius: 16 }} resizeMode="cover" />
              {result.hasVocals && (
                <View style={s.imgBadge}>
                  <Icon name="music" size={12} color="#fff" />
                  <Text style={s.imgBadgeText}>AI Vocals</Text>
                </View>
              )}
            </View>
          )}
          <AudioPlayerCard title="Image Soundtrack" audioUri={result.audioUrl} badge={result.hasVocals ? 'With Vocals' : 'Instrumental'} />
        </View>
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

  const [voices, setVoices] = useState<VoiceList>({ premadeVoices: [], clonedVoices: [] });
  const [voicesLoading, setVoicesLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(user?.walletBalance ?? 0);

  const fetchVoices = useCallback(async () => {
    if (!session?.access_token) return;
    setVoicesLoading(true);
    try {
      const res = await supabaseFetch('/functions/v1/get-user-voices', {
        method: 'POST',
        body: JSON.stringify({}),
      }, session.access_token);
      if (res.ok) {
        const data = await res.json() as { premadeVoices?: VoiceItem[]; clonedVoices?: VoiceItem[] };
        setVoices({ premadeVoices: data.premadeVoices ?? [], clonedVoices: data.clonedVoices ?? [] });
        setVoicesLoading(false);
        return;
      }
    } catch {}
    try {
      const fallback = await supabaseFetch('/functions/v1/elevenlabs-get-user-voices', {
        method: 'POST',
        body: JSON.stringify({}),
      }, session.access_token);
      if (fallback.ok) {
        const data = await fallback.json() as { premadeVoices?: VoiceItem[]; clonedVoices?: VoiceItem[] };
        setVoices({ premadeVoices: data.premadeVoices ?? [], clonedVoices: data.clonedVoices ?? [] });
      }
    } catch {}
    setVoicesLoading(false);
  }, [session]);

  const fetchWallet = useCallback(async () => {
    if (!session?.access_token || !user?.id) return;
    try {
      const res = await supabaseFetch(`/rest/v1/profiles?select=wallet_balance&id=eq.${user.id}&limit=1`, {}, session.access_token);
      if (res.ok) {
        const rows = await res.json() as Array<{ wallet_balance: number }>;
        if (rows?.length) setWalletBalance(rows[0].wallet_balance ?? 0);
      }
    } catch {}
  }, [session, user]);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false }).catch(() => {});
    fetchVoices();
    fetchWallet();
  }, [fetchVoices, fetchWallet]);

  const ctx: MusicCtx = {
    voices,
    voicesLoading,
    walletBalance,
    refreshWallet: fetchWallet,
    session,
    userId: user?.id ?? '',
    onVoiceCloned: fetchVoices,
  };

  const TABS: React.ReactElement[] = [
    <TTSTab ctx={ctx} />,
    <ConvertTab ctx={ctx} />,
    <CloneTab ctx={ctx} />,
    <SFXTab ctx={ctx} />,
    <IsolateTab ctx={ctx} />,
    <MusicTab ctx={ctx} />,
    <ImageMusicTab ctx={ctx} />,
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={[{ flex: 1 }, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#7B2FFF', '#B44CFF', '#E8527A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.header, { paddingTop: topPad + 12 }]}>
          <Text style={s.headerTitle}>AI Music Studio</Text>
          <Text style={s.headerSub}>7 AI-powered audio tools in one place</Text>
        </LinearGradient>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <WalletCard balance={walletBalance} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBar} style={[s.tabBarWrap, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          {MUSIC_TABS.map((tab, i) => (
            <TouchableOpacity key={tab} style={[s.tabPill, activeTab === i && s.tabPillActive]} onPress={() => setActiveTab(i)}>
              <Text style={[s.tabPillText, { color: activeTab === i ? '#B44CFF' : colors.mutedForeground }]}>{tab}</Text>
              {activeTab === i && <View style={s.tabUnderline} />}
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
  headerTitle: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', color: '#fff', marginBottom: 6 },
  headerSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)' },
  walletCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 4, gap: 10 },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  walletLabel: { fontSize: 13, fontFamily: 'Inter_400Regular', flex: 1 },
  walletBalance: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#B44CFF' },
  priceRow: { gap: 8, paddingVertical: 2 },
  priceChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', gap: 2 },
  priceChipName: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  priceChipVal: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  tabBarWrap: { borderBottomWidth: 1 },
  tabBar: { paddingHorizontal: 16, paddingTop: 4, gap: 4 },
  tabPill: { paddingHorizontal: 14, paddingVertical: 12, position: 'relative' },
  tabPillActive: {},
  tabPillText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  tabUnderline: { position: 'absolute', bottom: 0, left: 14, right: 14, height: 2, backgroundColor: '#B44CFF', borderRadius: 1 },
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
  imgBadge: { position: 'absolute', bottom: 10, right: 10, backgroundColor: '#B44CFF', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  imgBadgeText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
});
