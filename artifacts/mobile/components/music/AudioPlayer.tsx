/** Animated waveform bars and the gradient audio player card used to play and save every generated track. */
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';
import { saveAudioToCache, downloadToDevice, downloadUrlToDevice, fmtMs, s } from './shared';

export function WaveformBar({ delay, color = '#FF6B33', active = true }: { delay: number; color?: string; active?: boolean }) {
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

export function AudioPlayerCard({ title, audioUri, badge }: { title: string; audioUri: string; badge?: string }) {
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
    } catch (err) {
      setPlaying(false);
      const reason = err instanceof Error ? err.message : String(err);
      console.warn('[music] playback failed', audioUri.slice(0, 120), reason);
      Alert.alert('Could not play audio', reason);
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
