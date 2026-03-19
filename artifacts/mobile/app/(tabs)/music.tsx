import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
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
import { useTheme } from '@/context/ThemeContext';

const GENRES = ['Bollywood', 'Pop', 'Classical', 'Hip-Hop', 'Devotional'];
const MOODS = ['Happy', 'Romantic', 'Energetic', 'Calm', 'Celebratory'];
const OCCASIONS = ['Birthday', 'Anniversary', 'Wedding', 'Graduation'];

const PREV_SONGS = [
  { id: '1', title: 'Birthday Beats', genre: 'Pop', duration: '2:34', date: '2025-01-10' },
  { id: '2', title: 'Wedding Melodies', genre: 'Bollywood', duration: '3:12', date: '2024-12-28' },
];

function WaveformBar({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 300 + delay, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 300 + delay, useNativeDriver: true }),
      ]).start(() => animate());
    };
    const t = setTimeout(animate, delay);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View
      style={{
        width: 4,
        height: 32,
        backgroundColor: '#FF6B33',
        borderRadius: 2,
        transform: [{ scaleY: anim }],
      }}
    />
  );
}

export default function MusicScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [genre, setGenre] = useState('Bollywood');
  const [mood, setMood] = useState('Happy');
  const [occasion, setOccasion] = useState('Birthday');
  const [desc, setDesc] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<{ title: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const handleGenerate = () => {
    setGenerating(true);
    setGenerated(null);
    setTimeout(() => {
      setGenerating(false);
      setGenerated({ title: `${mood} ${occasion} Song` });
    }, 2500);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={['#B44CFF', '#7B2FFF', '#4B0082']}
          style={[styles.header, { paddingTop: topPad + 12 }]}
        >
          <Text style={styles.headerTitle}>AI Music Studio</Text>
          <Text style={styles.headerSub}>Generate personalized songs with AI</Text>
        </LinearGradient>

        <View style={styles.content}>
          {/* Genre */}
          <Text style={[styles.label, { color: colors.foreground }]}>Genre</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {GENRES.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.chip, { backgroundColor: genre === g ? '#B44CFF' : colors.muted }]}
                onPress={() => setGenre(g)}
              >
                <Text style={[styles.chipText, { color: genre === g ? '#fff' : colors.foreground }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Mood */}
          <Text style={[styles.label, { color: colors.foreground }]}>Mood</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {MOODS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, { backgroundColor: mood === m ? '#FF6B33' : colors.muted }]}
                onPress={() => setMood(m)}
              >
                <Text style={[styles.chipText, { color: mood === m ? '#fff' : colors.foreground }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Description */}
          <Text style={[styles.label, { color: colors.foreground }]}>Describe your song</Text>
          <TextInput
            style={[styles.textarea, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground, fontFamily: 'Inter_400Regular' }]}
            placeholder="A romantic song for my parents' anniversary with classical elements..."
            placeholderTextColor={colors.mutedForeground}
            value={desc}
            onChangeText={setDesc}
            multiline
            numberOfLines={3}
          />

          {/* Occasion */}
          <Text style={[styles.label, { color: colors.foreground }]}>Occasion</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {OCCASIONS.map((o) => (
              <TouchableOpacity
                key={o}
                style={[styles.chip, { backgroundColor: occasion === o ? '#E8527A' : colors.muted }]}
                onPress={() => setOccasion(o)}
              >
                <Text style={[styles.chipText, { color: occasion === o ? '#fff' : colors.foreground }]}>{o}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Generate Button */}
          <TouchableOpacity
            onPress={handleGenerate}
            disabled={generating}
            style={{ marginTop: 8, opacity: generating ? 0.7 : 1 }}
          >
            <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.generateBtn}>
              <Feather name="music" size={18} color="#fff" />
              <Text style={styles.generateBtnText}>{generating ? 'Generating...' : 'Generate Song'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Generated song */}
          {generated && (
            <View style={[styles.songCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <LinearGradient colors={['#FF6B33', '#B44CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.songGradient}>
                <Text style={styles.songTitle}>{generated.title}</Text>
                <View style={styles.waveform}>
                  {Array.from({ length: 20 }).map((_, i) => (
                    <WaveformBar key={i} delay={i * 50} />
                  ))}
                </View>
                <View style={styles.songControls}>
                  <TouchableOpacity onPress={() => setIsPlaying(!isPlaying)} style={styles.playBtn}>
                    <Feather name={isPlaying ? 'pause' : 'play'} size={22} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.duration}>2:34</Text>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Previous songs */}
          {PREV_SONGS.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={[styles.label, { color: colors.foreground }]}>Previous Songs</Text>
              {PREV_SONGS.map((song) => (
                <View key={song.id} style={[styles.prevSong, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.prevSongIcon, { backgroundColor: '#B44CFF20' }]}>
                    <Feather name="music" size={18} color="#B44CFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.prevSongTitle, { color: colors.foreground }]}>{song.title}</Text>
                    <Text style={[styles.prevSongMeta, { color: colors.mutedForeground }]}>{song.genre} · {song.date}</Text>
                  </View>
                  <Text style={[styles.prevSongDur, { color: colors.mutedForeground }]}>{song.duration}</Text>
                  <TouchableOpacity>
                    <Feather name="play-circle" size={28} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerTitle: { fontSize: 26, fontFamily: 'PlayfairDisplay_700Bold', color: '#fff', marginBottom: 6 },
  headerSub: { fontSize: 14, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)' },
  content: { padding: 20 },
  label: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 10, marginTop: 16 },
  chips: { gap: 8, paddingBottom: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 9999 },
  chipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  textarea: { borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  generateBtn: { height: 52, borderRadius: 9999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  generateBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  songCard: { marginTop: 20, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  songGradient: { padding: 20 },
  songTitle: { color: '#fff', fontSize: 18, fontFamily: 'PlayfairDisplay_700Bold', marginBottom: 16 },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 40, marginBottom: 16 },
  songControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  duration: { color: '#fff', fontSize: 14, fontFamily: 'Inter_500Medium' },
  prevSong: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  prevSongIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  prevSongTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  prevSongMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  prevSongDur: { fontSize: 12, fontFamily: 'Inter_500Medium' },
});
