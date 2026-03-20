import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
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
import { useTheme } from '@/context/ThemeContext';

const MUSIC_TABS = [
  'Text to Speech',
  'Voice Conversion',
  'Sound Effects',
  'Audio Isolation',
  'Music Generation',
  'Clone Voice',
  'Image + Music',
];

const VOICES = ['Riya (Female)', 'Arjun (Male)', 'Priya (Soft)', 'Dev (Deep)', 'Ananya (Young)'];
const GENRES = ['Bollywood', 'Pop', 'Classical', 'Hip-Hop', 'Devotional', 'Jazz', 'Electronic'];
const MOODS = ['Happy', 'Romantic', 'Energetic', 'Calm', 'Celebratory', 'Melancholic'];
const VOICE_TYPES = ['Instrumental', 'AI Voice', 'Cloned Voice'];

function WaveformBar({ delay, color = '#FF6B33' }: { delay: number; color?: string }) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    let stopped = false;
    const animate = () => {
      if (stopped) return;
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 300 + delay, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 300 + delay, useNativeDriver: true }),
      ]).start(() => { if (!stopped) animate(); });
    };
    const t = setTimeout(animate, delay);
    return () => { stopped = true; clearTimeout(t); };
  }, []);

  return (
    <Animated.View style={{ width: 4, height: 28, backgroundColor: color, borderRadius: 2, transform: [{ scaleY: anim }] }} />
  );
}

function AudioPlayerCard({ title, duration = '0:30', onDownload }: { title: string; duration?: string; onDownload?: () => void }) {
  const { colors } = useTheme();
  const [playing, setPlaying] = useState(false);
  return (
    <View style={[s.playerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.playerGradient}>
        <Text style={s.playerTitle}>{title}</Text>
        <View style={s.waveRow}>
          {Array.from({ length: 18 }).map((_, i) => (
            <WaveformBar key={i} delay={i * 60} color={playing ? '#fff' : 'rgba(255,255,255,0.6)'} />
          ))}
        </View>
        <View style={s.playerControls}>
          <TouchableOpacity style={s.playBtn} onPress={() => setPlaying(p => !p)}>
            <Icon name={playing ? 'pause' : 'play'} size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={s.playerDuration}>{duration}</Text>
          <TouchableOpacity style={s.dlBtn} onPress={onDownload}>
            <Icon name="download" size={15} color="#fff" />
            <Text style={s.dlText}>Download</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

type RecorderState = 'idle' | 'recording' | 'preview';

function AudioRecorder({ label = 'Record Audio', onPreview }: { label?: string; onPreview?: () => void }) {
  const { colors } = useTheme();
  const [state, setState] = useState<RecorderState>('idle');
  const [secs, setSecs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const startPulse = useCallback(() => {
    pulseAnim.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    pulseRef.current = loop;
    loop.start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    if (pulseRef.current) { pulseRef.current.stop(); pulseRef.current = null; }
  }, []);

  const handleRecord = () => {
    if (state === 'idle') {
      setState('recording');
      setSecs(0);
      startPulse();
      timerRef.current = setInterval(() => setSecs(s => s + 1), 1000);
    } else if (state === 'recording') {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      stopPulse();
      setState('preview');
      onPreview?.();
    }
  };

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopPulse();
  }, [stopPulse]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (state === 'preview') {
    return (
      <View style={[s.recorderPreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.waveRow}>
          {Array.from({ length: 12 }).map((_, i) => (
            <WaveformBar key={i} delay={i * 80} color="#B44CFF" />
          ))}
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
    <TouchableOpacity style={[s.recorderBtn, { backgroundColor: state === 'recording' ? '#FF6B3315' : colors.card, borderColor: state === 'recording' ? '#FF6B33' : colors.border }]} onPress={handleRecord} activeOpacity={0.8}>
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
  );
}

function UploadOrRecord({ onPreview }: { onPreview?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={s.uploadOrRec}>
      <TouchableOpacity style={[s.uploadBtn, { borderColor: colors.border, backgroundColor: colors.card }]} activeOpacity={0.8}>
        <Icon name="upload" size={18} color="#B44CFF" />
        <Text style={[s.uploadText, { color: colors.foreground }]}>Upload Audio</Text>
      </TouchableOpacity>
      <View style={s.orDivider}>
        <View style={[s.divLine, { backgroundColor: colors.border }]} />
        <Text style={[s.orText, { color: colors.mutedForeground }]}>or</Text>
        <View style={[s.divLine, { backgroundColor: colors.border }]} />
      </View>
      <AudioRecorder onPreview={onPreview} />
    </View>
  );
}

function VoiceSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <TouchableOpacity style={[s.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setOpen(o => !o)}>
        <Text style={[s.dropdownText, { color: colors.foreground }]}>{value}</Text>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      {open && (
        <View style={[s.dropdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {VOICES.map(v => (
            <TouchableOpacity key={v} style={[s.dropdownItem, v === value && { backgroundColor: '#B44CFF20' }]} onPress={() => { onChange(v); setOpen(false); }}>
              <Text style={[s.dropdownItemText, { color: v === value ? '#B44CFF' : colors.foreground }]}>{v}</Text>
              {v === value && <Icon name="check" size={14} color="#B44CFF" />}
            </TouchableOpacity>
          ))}
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

function DurationSlider({ value, onChange, min = 1, max = 30 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const { colors } = useTheme();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <View>
      <View style={s.sliderRow}>
        <TouchableOpacity style={[s.sliderBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => onChange(Math.max(min, value - 1))}>
          <Icon name="minus" size={16} color={colors.foreground} />
        </TouchableOpacity>
        <View style={[s.sliderTrack, { backgroundColor: colors.muted }]}>
          <View style={[s.sliderFill, { width: `${pct}%` }]} />
        </View>
        <TouchableOpacity style={[s.sliderBtn, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => onChange(Math.min(max, value + 1))}>
          <Icon name="plus" size={16} color={colors.foreground} />
        </TouchableOpacity>
      </View>
      <Text style={[s.sliderLabel, { color: colors.mutedForeground }]}>{value}s</Text>
    </View>
  );
}

function GenBtn({ label, onPress, generating }: { label: string; onPress: () => void; generating: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={generating} style={{ marginTop: 16, opacity: generating ? 0.7 : 1 }} activeOpacity={0.85}>
      <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.genBtn}>
        <Icon name="zap" size={18} color="#fff" />
        <Text style={s.genBtnText}>{generating ? 'Generating...' : label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function SectionLabel({ text }: { text: string }) {
  const { colors } = useTheme();
  return <Text style={[s.sectionLabel, { color: colors.foreground }]}>{text}</Text>;
}

function TTSTab() {
  const { colors } = useTheme();
  const [voice, setVoice] = useState(VOICES[0]);
  const [text, setText] = useState('');
  const [gen, setGen] = useState(false);
  const [done, setDone] = useState(false);

  const generate = () => { setGen(true); setDone(false); setTimeout(() => { setGen(false); setDone(true); }, 2000); };

  return (
    <View style={s.tabContent}>
      <SectionLabel text="Select Voice" />
      <VoiceSelect value={voice} onChange={setVoice} />
      <SectionLabel text="Enter Text" />
      <TextInput
        style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
        placeholder="Type the text you want converted to speech..."
        placeholderTextColor={colors.mutedForeground}
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={4}
      />
      <GenBtn label="Generate Speech (₹50)" onPress={generate} generating={gen} />
      {done && <AudioPlayerCard title="Generated Speech" duration="0:18" />}
    </View>
  );
}

function VoiceConversionTab() {
  const { colors } = useTheme();
  const [voice, setVoice] = useState(VOICES[0]);
  const [gen, setGen] = useState(false);
  const [done, setDone] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);

  const generate = () => { if (!hasAudio) return; setGen(true); setDone(false); setTimeout(() => { setGen(false); setDone(true); }, 2200); };

  return (
    <View style={s.tabContent}>
      <SectionLabel text="Upload or Record Audio" />
      <UploadOrRecord onPreview={() => setHasAudio(true)} />
      <SectionLabel text="Target Voice" />
      <VoiceSelect value={voice} onChange={setVoice} />
      <GenBtn label="Convert Voice (₹75)" onPress={generate} generating={gen} />
      {done && <AudioPlayerCard title="Voice-Converted Audio" duration="0:22" />}
    </View>
  );
}

function SoundEffectsTab() {
  const { colors } = useTheme();
  const [desc, setDesc] = useState('');
  const [duration, setDuration] = useState(10);
  const [gen, setGen] = useState(false);
  const [done, setDone] = useState(false);

  const generate = () => { setGen(true); setDone(false); setTimeout(() => { setGen(false); setDone(true); }, 2000); };

  return (
    <View style={s.tabContent}>
      <SectionLabel text="Describe the Sound Effect" />
      <TextInput
        style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
        placeholder="e.g. Rain on a rooftop, crowd cheering at a stadium..."
        placeholderTextColor={colors.mutedForeground}
        value={desc}
        onChangeText={setDesc}
        multiline
        numberOfLines={3}
      />
      <SectionLabel text="Duration" />
      <DurationSlider value={duration} onChange={setDuration} />
      <GenBtn label="Generate Effect (₹60)" onPress={generate} generating={gen} />
      {done && <AudioPlayerCard title="Sound Effect" duration={`0:${duration.toString().padStart(2, '0')}`} />}
    </View>
  );
}

function AudioIsolationTab() {
  const { colors } = useTheme();
  const [gen, setGen] = useState(false);
  const [done, setDone] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);

  const generate = () => { if (!hasAudio) return; setGen(true); setDone(false); setTimeout(() => { setGen(false); setDone(true); }, 2500); };

  return (
    <View style={s.tabContent}>
      <SectionLabel text="Upload or Record Audio" />
      <UploadOrRecord onPreview={() => setHasAudio(true)} />
      <View style={[s.infoBox, { backgroundColor: '#B44CFF15', borderColor: '#B44CFF40' }]}>
        <Icon name="info" size={14} color="#B44CFF" />
        <Text style={s.infoText}>AI will separate vocals and background music from your audio</Text>
      </View>
      <GenBtn label="Isolate Vocals (₹40)" onPress={generate} generating={gen} />
      {done && (
        <View style={s.isolationResults}>
          <Text style={[s.sectionLabel, { color: colors.foreground, marginTop: 8 }]}>Results</Text>
          <AudioPlayerCard title="Vocals Track" duration="2:34" />
          <View style={{ marginTop: 12 }}>
            <AudioPlayerCard title="Music / Instrumental" duration="2:34" />
          </View>
        </View>
      )}
    </View>
  );
}

function MusicGenerationTab() {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('Bollywood');
  const [mood, setMood] = useState('Happy');
  const [desc, setDesc] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [voiceType, setVoiceType] = useState('Instrumental');
  const [gen, setGen] = useState(false);
  const [done, setDone] = useState(false);
  const [lyricsGen, setLyricsGen] = useState(false);
  const [playing, setPlaying] = useState(false);

  const generate = () => { setGen(true); setDone(false); setTimeout(() => { setGen(false); setDone(true); }, 2500); };
  const generateLyrics = () => { setLyricsGen(true); setTimeout(() => { setLyricsGen(false); setLyrics('Tere bina zindagi se koi,\nShikwa toh nahi...\nTere bina zindagi bhi lekin,\nZindagi nahi...'); }, 1800); };

  return (
    <View style={s.tabContent}>
      <SectionLabel text="Song Title" />
      <TextInput
        style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
        placeholder="My Birthday Song"
        placeholderTextColor={colors.mutedForeground}
        value={title}
        onChangeText={setTitle}
      />
      <SectionLabel text="Genre" />
      <ChipSelect options={GENRES} value={genre} onChange={setGenre} activeColor="#B44CFF" />
      <SectionLabel text="Mood" />
      <ChipSelect options={MOODS} value={mood} onChange={setMood} activeColor="#FF6B33" />
      <SectionLabel text="Description" />
      <TextInput
        style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
        placeholder="A romantic song for my parents' anniversary with classical elements..."
        placeholderTextColor={colors.mutedForeground}
        value={desc}
        onChangeText={setDesc}
        multiline
        numberOfLines={3}
      />
      <View style={s.lyricHeader}>
        <SectionLabel text="Lyrics" />
        <TouchableOpacity style={[s.aiLyricsBtn, { borderColor: '#B44CFF' }]} onPress={generateLyrics} disabled={lyricsGen}>
          <Icon name="zap" size={13} color="#B44CFF" />
          <Text style={s.aiLyricsBtnText}>{lyricsGen ? 'Generating...' : 'AI Generate Lyrics'}</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular', minHeight: 100 }]}
        placeholder="Enter your lyrics or use AI to generate..."
        placeholderTextColor={colors.mutedForeground}
        value={lyrics}
        onChangeText={setLyrics}
        multiline
        numberOfLines={5}
      />
      <SectionLabel text="Voice Type" />
      <View style={s.radioGroup}>
        {VOICE_TYPES.map(vt => (
          <TouchableOpacity key={vt} style={s.radioRow} onPress={() => setVoiceType(vt)}>
            <View style={[s.radioOuter, { borderColor: voiceType === vt ? '#B44CFF' : colors.border }]}>
              {voiceType === vt && <View style={s.radioInner} />}
            </View>
            <Text style={[s.radioText, { color: colors.foreground }]}>{vt}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <GenBtn label="Generate Music (₹100)" onPress={generate} generating={gen} />
      {done && (
        <View style={[s.playerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.playerGradient}>
            <Text style={s.playerTitle}>{title || `${mood} ${genre} Song`}</Text>
            <View style={s.waveRow}>
              {Array.from({ length: 20 }).map((_, i) => (
                <WaveformBar key={i} delay={i * 50} color={playing ? '#fff' : 'rgba(255,255,255,0.6)'} />
              ))}
            </View>
            <View style={s.playerControls}>
              <TouchableOpacity style={s.playBtn} onPress={() => setPlaying(p => !p)}>
                <Icon name={playing ? 'pause' : 'play'} size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={s.playerDuration}>2:34</Text>
              <TouchableOpacity style={s.dlBtn}>
                <Icon name="download" size={15} color="#fff" />
                <Text style={s.dlText}>Download</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

function CloneVoiceTab() {
  const { colors } = useTheme();
  const [voiceName, setVoiceName] = useState('');
  const [voiceDesc, setVoiceDesc] = useState('');
  const [gen, setGen] = useState(false);
  const [done, setDone] = useState(false);

  const generate = () => { setGen(true); setDone(false); setTimeout(() => { setGen(false); setDone(true); }, 2800); };

  return (
    <View style={s.tabContent}>
      <SectionLabel text="Upload or Record Voice Sample" />
      <View style={[s.infoBox, { backgroundColor: '#FF6B3315', borderColor: '#FF6B3340' }]}>
        <Icon name="info" size={14} color="#FF6B33" />
        <Text style={[s.infoText, { color: '#FF6B33' }]}>For best results, record at least 30 seconds of clear speech</Text>
      </View>
      <UploadOrRecord />
      <SectionLabel text="Voice Name" />
      <TextInput
        style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
        placeholder="My Custom Voice"
        placeholderTextColor={colors.mutedForeground}
        value={voiceName}
        onChangeText={setVoiceName}
      />
      <SectionLabel text="Description (optional)" />
      <TextInput
        style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
        placeholder="e.g. Deep male voice with a slight accent..."
        placeholderTextColor={colors.mutedForeground}
        value={voiceDesc}
        onChangeText={setVoiceDesc}
        multiline
        numberOfLines={3}
      />
      <GenBtn label="Clone Voice (₹150)" onPress={generate} generating={gen} />
      {done && (
        <View style={[s.successCard, { backgroundColor: '#22c55e15', borderColor: '#22c55e40' }]}>
          <View style={s.successIcon}>
            <Icon name="check-circle" size={28} color="#22c55e" />
          </View>
          <Text style={[s.successTitle, { color: colors.foreground }]}>Voice Cloned Successfully!</Text>
          <Text style={[s.successSub, { color: colors.mutedForeground }]}>"{voiceName || 'My Custom Voice'}" has been saved to your voice library and can be used in Music Generation.</Text>
        </View>
      )}
    </View>
  );
}

function ImageMusicTab() {
  const { colors } = useTheme();
  const [desc, setDesc] = useState('');
  const [genre, setGenre] = useState('Bollywood');
  const [mood, setMood] = useState('Happy');
  const [lyrics, setLyrics] = useState('');
  const [duration, setDuration] = useState(15);
  const [audioSource, setAudioSource] = useState<'generate' | 'upload'>('generate');
  const [hasImage, setHasImage] = useState(false);
  const [gen, setGen] = useState(false);
  const [done, setDone] = useState(false);

  const generate = () => { setGen(true); setDone(false); setTimeout(() => { setGen(false); setDone(true); }, 3000); };

  return (
    <View style={s.tabContent}>
      <SectionLabel text="Upload Image" />
      {hasImage ? (
        <View style={[s.imagePreview, { borderColor: '#B44CFF' }]}>
          <View style={[s.imagePlaceholder, { backgroundColor: '#B44CFF20' }]}>
            <Icon name="image" size={40} color="#B44CFF" />
            <Text style={[s.imagePlaceholderText, { color: '#B44CFF' }]}>image_upload.jpg</Text>
          </View>
          <TouchableOpacity style={s.changeImageBtn} onPress={() => setHasImage(false)}>
            <Text style={s.changeImageText}>Change</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={[s.imageUploadArea, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => setHasImage(true)}>
          <Icon name="upload" size={28} color="#B44CFF" />
          <Text style={[s.imageUploadText, { color: colors.foreground }]}>Tap to Upload Image</Text>
          <Text style={[s.imageUploadHint, { color: colors.mutedForeground }]}>JPG, PNG up to 10MB</Text>
        </TouchableOpacity>
      )}
      <SectionLabel text="Description" />
      <TextInput
        style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
        placeholder="A peaceful beach sunset with waves..."
        placeholderTextColor={colors.mutedForeground}
        value={desc}
        onChangeText={setDesc}
        multiline
        numberOfLines={3}
      />
      <SectionLabel text="Genre" />
      <ChipSelect options={GENRES} value={genre} onChange={setGenre} activeColor="#B44CFF" />
      <SectionLabel text="Mood" />
      <ChipSelect options={MOODS} value={mood} onChange={setMood} activeColor="#FF6B33" />
      <SectionLabel text="Lyrics (optional)" />
      <TextInput
        style={[s.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
        placeholder="Add lyrics to be sung over the music..."
        placeholderTextColor={colors.mutedForeground}
        value={lyrics}
        onChangeText={setLyrics}
        multiline
        numberOfLines={3}
      />
      <SectionLabel text="Duration" />
      <DurationSlider value={duration} onChange={setDuration} max={60} />
      <SectionLabel text="Audio Source" />
      <View style={[s.toggleRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        {(['generate', 'upload'] as const).map(opt => (
          <TouchableOpacity key={opt} style={[s.toggleOpt, audioSource === opt && s.toggleOptActive]} onPress={() => setAudioSource(opt)}>
            <Text style={[s.toggleOptText, { color: audioSource === opt ? '#fff' : colors.foreground }]}>
              {opt === 'generate' ? 'AI Generate' : 'Upload Audio'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {audioSource === 'upload' && <UploadOrRecord />}
      <GenBtn label="Create (₹120)" onPress={generate} generating={gen} />
      {done && (
        <View style={[s.playerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.imagePlaceholder, { backgroundColor: '#B44CFF20', height: 160, borderRadius: 0 }]}>
            <Icon name="image" size={36} color="#B44CFF" />
            <Text style={[s.imagePlaceholderText, { color: '#B44CFF' }]}>Your Image</Text>
          </View>
          <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.playerGradient}>
            <Text style={s.playerTitle}>Image Soundtrack</Text>
            <View style={s.waveRow}>
              {Array.from({ length: 16 }).map((_, i) => <WaveformBar key={i} delay={i * 70} />)}
            </View>
            <View style={s.playerControls}>
              <TouchableOpacity style={s.playBtn}><Icon name="play" size={20} color="#fff" /></TouchableOpacity>
              <Text style={s.playerDuration}>0:{duration.toString().padStart(2, '0')}</Text>
              <TouchableOpacity style={s.dlBtn}><Icon name="download" size={15} color="#fff" /><Text style={s.dlText}>Download</Text></TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

export default function MusicScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(0);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const tabs = [TTSTab, VoiceConversionTab, SoundEffectsTab, AudioIsolationTab, MusicGenerationTab, CloneVoiceTab, ImageMusicTab];
  const ActiveTab = tabs[activeTab];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={[{ flex: 1 }, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={['#7B2FFF', '#B44CFF', '#E8527A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.header, { paddingTop: topPad + 12 }]}>
          <Text style={s.headerTitle}>AI Music Studio</Text>
          <Text style={s.headerSub}>7 AI-powered audio tools in one place</Text>
        </LinearGradient>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabBar} style={[s.tabBarWrap, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          {MUSIC_TABS.map((tab, i) => (
            <TouchableOpacity key={tab} style={[s.tabPill, activeTab === i && s.tabPillActive]} onPress={() => setActiveTab(i)}>
              <Text style={[s.tabPillText, { color: activeTab === i ? '#B44CFF' : colors.mutedForeground }]}>{tab}</Text>
              {activeTab === i && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ActiveTab />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerTitle: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', color: '#fff', marginBottom: 6 },
  headerSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)' },
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
  playerTitle: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 12 },
  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 36, marginBottom: 12 },
  playerControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  playerDuration: { color: '#fff', fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
  dlBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999 },
  dlText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_500Medium' },
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
  dropdownText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  dropdownList: { borderRadius: 12, borderWidth: 1.5, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  dropdownItemText: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sliderBtn: { width: 36, height: 36, borderRadius: 9999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  sliderTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  sliderFill: { height: 6, backgroundColor: '#B44CFF', borderRadius: 3 },
  sliderLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 4 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
  infoText: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#B44CFF', flex: 1 },
  isolationResults: { gap: 0 },
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
  imageUploadHint: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  imagePreview: { borderRadius: 16, borderWidth: 2, overflow: 'hidden' },
  imagePlaceholder: { height: 120, alignItems: 'center', justifyContent: 'center', gap: 8 },
  imagePlaceholderText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  changeImageBtn: { padding: 10, alignItems: 'center' },
  changeImageText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#B44CFF' },
  toggleRow: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, overflow: 'hidden', padding: 4, gap: 4 },
  toggleOpt: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  toggleOptActive: { backgroundColor: '#B44CFF' },
  toggleOptText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
});
